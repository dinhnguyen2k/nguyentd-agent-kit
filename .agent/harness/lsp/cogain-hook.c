#define _POSIX_C_SOURCE 200809L
#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/time.h>
#include <sys/un.h>
#include <unistd.h>

#define MAX_PAYLOAD_BYTES (8 * 1024 * 1024)
#define READ_CHUNK_BYTES 16384

static int write_all(int fd, const char *buf, size_t len) {
  size_t off = 0;
  while (off < len) {
    ssize_t n = write(fd, buf + off, len - off);
    if (n < 0) {
      if (errno == EINTR) continue;
      return -1;
    }
    off += (size_t)n;
  }
  return 0;
}

static void emit_fail_open(const char *mode) {
  if (strcmp(mode, "pre") == 0) {
    const char *msg = "{\"decision\":\"allow\"}\n";
    (void)write_all(STDOUT_FILENO, msg, strlen(msg));
  } else {
    const char *msg = "{}\n";
    (void)write_all(STDOUT_FILENO, msg, strlen(msg));
  }
}

static char *read_stdin_all(size_t *out_len) {
  size_t cap = READ_CHUNK_BYTES;
  size_t len = 0;
  char *buf = malloc(cap);
  if (!buf) return NULL;

  for (;;) {
    if (len + READ_CHUNK_BYTES + 1 > cap) {
      if (cap >= MAX_PAYLOAD_BYTES) {
        free(buf);
        return NULL;
      }
      size_t next_cap = cap * 2;
      if (next_cap > MAX_PAYLOAD_BYTES) next_cap = MAX_PAYLOAD_BYTES;
      char *next_buf = realloc(buf, next_cap);
      if (!next_buf) {
        free(buf);
        return NULL;
      }
      buf = next_buf;
      cap = next_cap;
    }
    ssize_t n = read(STDIN_FILENO, buf + len, cap - len - 1);
    if (n < 0) {
      if (errno == EINTR) continue;
      free(buf);
      return NULL;
    }
    if (n == 0) break;
    len += (size_t)n;
  }
  buf[len] = '\0';
  *out_len = len;
  return buf;
}

static int is_whitespace_only(const char *buf, size_t len) {
  for (size_t i = 0; i < len; i++) {
    unsigned char c = (unsigned char)buf[i];
    if (c != ' ' && c != '\t' && c != '\r' && c != '\n') return 0;
  }
  return 1;
}

static int try_unix_hook(const char *sock_path, const char *mode, const char *cwd,
                         const char *payload, size_t payload_len) {
  if (!sock_path || strlen(sock_path) >= sizeof(((struct sockaddr_un *)0)->sun_path)) {
    return -1;
  }

  int fd = socket(AF_UNIX, SOCK_STREAM, 0);
  if (fd < 0) return -1;

  struct timeval snd_tv = { .tv_sec = 2, .tv_usec = 0 };
  struct timeval rcv_tv = { .tv_sec = 4, .tv_usec = 0 };
  (void)setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &snd_tv, sizeof(snd_tv));
  (void)setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &rcv_tv, sizeof(rcv_tv));

  struct sockaddr_un addr;
  memset(&addr, 0, sizeof(addr));
  addr.sun_family = AF_UNIX;
  snprintf(addr.sun_path, sizeof(addr.sun_path), "%s", sock_path);

  if (connect(fd, (struct sockaddr *)&addr, sizeof(addr)) != 0) {
    close(fd);
    return -1;
  }

  char header[PATH_MAX + 64];
  int hlen = snprintf(header, sizeof(header), "%s\t%s\n", mode, cwd ? cwd : "");
  if (hlen <= 0 || (size_t)hlen >= sizeof(header)) {
    close(fd);
    return -1;
  }

  if (write_all(fd, header, (size_t)hlen) != 0 ||
      write_all(fd, payload, payload_len) != 0 ||
      shutdown(fd, SHUT_WR) != 0) {
    close(fd);
    return -1;
  }

  size_t rcap = READ_CHUNK_BYTES;
  size_t rlen = 0;
  char *resp = malloc(rcap);
  if (!resp) {
    close(fd);
    return -1;
  }

  for (;;) {
    if (rlen + 4096 + 1 > rcap) {
      if (rcap >= MAX_PAYLOAD_BYTES) {
        free(resp);
        close(fd);
        return -1;
      }
      size_t next_cap = rcap * 2;
      if (next_cap > MAX_PAYLOAD_BYTES) next_cap = MAX_PAYLOAD_BYTES;
      char *next_resp = realloc(resp, next_cap);
      if (!next_resp) {
        free(resp);
        close(fd);
        return -1;
      }
      resp = next_resp;
      rcap = next_cap;
    }
    ssize_t n = read(fd, resp + rlen, rcap - rlen - 1);
    if (n < 0) {
      if (errno == EINTR) continue;
      free(resp);
      close(fd);
      return -1;
    }
    if (n == 0) break;
    rlen += (size_t)n;
  }
  close(fd);
  resp[rlen] = '\0';

  size_t start = 0;
  while (start < rlen && (resp[start] == ' ' || resp[start] == '\t' || resp[start] == '\r' || resp[start] == '\n')) {
    start++;
  }
  if (start >= rlen || resp[start] != '{') {
    free(resp);
    return -1;
  }

  (void)write_all(STDOUT_FILENO, resp + start, rlen - start);
  if (resp[rlen - 1] != '\n') {
    (void)write_all(STDOUT_FILENO, "\n", 1);
  }
  free(resp);
  return 0;
}

static void spawn_daemon_background(const char *lsp_home, const char *cwd) {
  if (!lsp_home || !*lsp_home) return;
  char daemon_path[PATH_MAX];
  snprintf(daemon_path, sizeof(daemon_path), "%s/daemon.mjs", lsp_home);
  if (access(daemon_path, R_OK) != 0) return;

  pid_t pid = fork();
  if (pid != 0) return;

  (void)setsid();
  int devnull = open("/dev/null", O_RDWR);
  if (devnull >= 0) {
    (void)dup2(devnull, STDIN_FILENO);
    (void)dup2(devnull, STDOUT_FILENO);
    (void)dup2(devnull, STDERR_FILENO);
    if (devnull > STDERR_FILENO) close(devnull);
  }
  if (cwd && *cwd) {
    (void)setenv("AGY_LSP_DEFAULT_WORKTREE", cwd, 0);
  }
  execlp("node", "node", daemon_path, (char *)NULL);
  _exit(127);
}

static int find_fallback_script(const char *explicit_arg, const char *mode, const char *cwd,
                                char *out_path, size_t out_cap) {
  if (explicit_arg && *explicit_arg && access(explicit_arg, R_OK) == 0) {
    snprintf(out_path, out_cap, "%s", explicit_arg);
    return 0;
  }
  const char *rel = strcmp(mode, "pre") == 0
    ? ".agent/harness/agy/boundary-guard.mjs"
    : ".agent/harness/agy/lifecycle-hook.mjs";

  char dir[PATH_MAX];
  if (cwd && *cwd) {
    snprintf(dir, sizeof(dir), "%s", cwd);
  } else {
    snprintf(dir, sizeof(dir), ".");
  }

  for (;;) {
    size_t dir_len = strlen(dir);
    size_t rel_len = strlen(rel);
    if (dir_len + 1 + rel_len < out_cap) {
      memcpy(out_path, dir, dir_len);
      out_path[dir_len] = '/';
      memcpy(out_path + dir_len + 1, rel, rel_len + 1);
      if (access(out_path, R_OK) == 0) return 0;
    }

    char *slash = strrchr(dir, '/');
    if (!slash) break;
    if (slash == dir) {
      if (1 + rel_len < out_cap) {
        out_path[0] = '/';
        memcpy(out_path + 1, rel, rel_len + 1);
        if (access(out_path, R_OK) == 0) return 0;
      }
      break;
    }
    *slash = '\0';
  }
  return -1;
}

static void exec_node_fallback(const char *mode, const char *explicit_arg, const char *cwd,
                               const char *payload, size_t payload_len) {
  char script_path[PATH_MAX];
  if (find_fallback_script(explicit_arg, mode, cwd, script_path, sizeof(script_path)) != 0) {
    emit_fail_open(mode);
    return;
  }

  char tmpl[] = "/tmp/cogain-hook-XXXXXX";
  int tmp_fd = mkstemp(tmpl);
  if (tmp_fd < 0) {
    emit_fail_open(mode);
    return;
  }
  (void)unlink(tmpl);

  if (write_all(tmp_fd, payload, payload_len) != 0 ||
      lseek(tmp_fd, 0, SEEK_SET) < 0 ||
      dup2(tmp_fd, STDIN_FILENO) < 0) {
    close(tmp_fd);
    emit_fail_open(mode);
    return;
  }
  if (tmp_fd != STDIN_FILENO) close(tmp_fd);

  execlp("node", "node", script_path, (char *)NULL);
  emit_fail_open(mode);
}

int main(int argc, char **argv) {
  const char *mode = (argc >= 2 && strcmp(argv[1], "lifecycle") == 0) ? "lifecycle" : "pre";
  const char *explicit_script = (argc >= 3) ? argv[2] : NULL;

  size_t payload_len = 0;
  char *payload = read_stdin_all(&payload_len);
  if (!payload) {
    emit_fail_open(mode);
    return 0;
  }
  if (is_whitespace_only(payload, payload_len)) {
    free(payload);
    emit_fail_open(mode);
    return 0;
  }

  char cwd_buf[PATH_MAX];
  const char *cwd = getcwd(cwd_buf, sizeof(cwd_buf));

  char lsp_home[PATH_MAX];
  const char *env_home = getenv("AGY_LSP_HOME");
  const char *user_home = getenv("HOME");
  if (env_home && *env_home) {
    snprintf(lsp_home, sizeof(lsp_home), "%s", env_home);
  } else if (user_home && *user_home) {
    snprintf(lsp_home, sizeof(lsp_home), "%s/.local/share/agy-lsp", user_home);
  } else {
    lsp_home[0] = '\0';
  }

  char sock_path[PATH_MAX];
  const char *env_sock = getenv("AGY_LSP_HOOK_SOCK");
  if (env_sock && *env_sock) {
    snprintf(sock_path, sizeof(sock_path), "%s", env_sock);
  } else if (lsp_home[0]) {
    snprintf(sock_path, sizeof(sock_path), "%s/hook.sock", lsp_home);
  } else {
    sock_path[0] = '\0';
  }

  if (sock_path[0] && try_unix_hook(sock_path, mode, cwd, payload, payload_len) == 0) {
    free(payload);
    return 0;
  }

  if ((!env_sock || !*env_sock) && lsp_home[0]) {
    spawn_daemon_background(lsp_home, cwd);
  }
  exec_node_fallback(mode, explicit_script, cwd, payload, payload_len);
  free(payload);
  return 0;
}
