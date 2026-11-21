"""Nối policy dùng chung; không dùng chung trạng thái hay ghi đè dữ liệu riêng."""

import argparse
import glob
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


SHARED_PATHS = (
    "AGENTS.md",
    "AI_RULES.md",
    "OPINION.md",
    ".agent/rules",
    ".agent/workflows",
    ".agent/harness/claude",
    ".agent/harness/codex",
    ".agent/harness/omp",
    ".agent/harness/agy",
    ".agent/harness/README.md",
    ".agent/contracts/agent-registry.json",
    ".agent/contracts/task-manifest.schema.json",
    ".agent/scripts/agent-lifecycle-core.mjs",
    ".agent/scripts/task-contract.mjs",
    ".agent/scripts/dispatch-contract.mjs",
    ".agent/scripts/treehouse_harness.py",
)
LOCAL_LINKS = {
    "CLAUDE.md": "AGENTS.md",
    "GEMINI.md": "AGENTS.md",
    "ANTIGRAVITY.md": "AGENTS.md",
    ".claude/settings.json": ".agent/harness/claude/settings.json",
    ".codex/config.toml": ".agent/harness/codex/config.toml",
    ".codex/hooks.json": ".agent/harness/codex/hooks.json",
    ".omp/RULES.md": ".agent/harness/omp/RULES.md",
    ".omp/WATCHDOG.md": ".agent/harness/omp/WATCHDOG.md",
    ".omp/WATCHDOG.yml": ".agent/harness/omp/WATCHDOG.yml",
    ".omp/config.yml": ".agent/harness/omp/config.yml",
    ".omp/lsp.json": ".agent/harness/omp/lsp.json",
    ".omp/rules": ".agent/harness/omp/rules",
    ".omp/hooks": ".agent/harness/omp/hooks",
    ".agents/hooks.json": ".agent/harness/agy/hooks.json",
    ".agents/skills": ".agent/skills",
    ".agents/workflows": ".agent/workflows",
}
PRIVATE_STATE = (
    ".agent/planning",
    ".agent/artifacts",
    ".agent/reports",
    ".agent/scratch",
    ".agent/task-manifests",
)


def git(repo, *args):
    return subprocess.run(
        ["git", "-C", str(repo), *args], check=True, capture_output=True,
        text=True, timeout=10,
    ).stdout


def worktrees(root):
    fields = git(root, "worktree", "list", "--porcelain", "-z").split("\0")
    return {Path(field[9:]).resolve() for field in fields if field.startswith("worktree ")}


def validate_worktree(root, target, registered):
    if not target.is_dir() or target == root or target not in registered:
        raise ValueError(f"Không phải linked worktree đang tồn tại: {target}")
    if not target.is_relative_to((Path.home() / ".treehouse").resolve()):
        raise ValueError(f"Từ chối worktree ngoài ~/.treehouse: {target}")
    common = ("rev-parse", "--path-format=absolute", "--git-common-dir")
    if Path(git(root, *common).strip()).resolve() != Path(git(target, *common).strip()).resolve():
        raise ValueError(f"Worktree không thuộc cùng repo: {target}")


def link_matches(destination, source):
    if not destination.is_symlink():
        return False
    return destination.resolve() == source.resolve()


def link_plan(root, target):
    sources = [(relative, root / relative) for relative in SHARED_PATHS]
    for relative in (*SHARED_PATHS, *LOCAL_LINKS.values()):
        source = (root / relative).resolve(strict=True)
        if not source.is_relative_to(root):
            raise ValueError(f"Nguồn dùng chung thoát repo: {relative}")
    sources.extend((relative, target / source) for relative, source in LOCAL_LINKS.items())
    plan = []
    for relative, source in sources:
        destination = target / relative
        if link_matches(destination, source):
            continue
        parent = destination.parent.resolve()
        if not parent.is_relative_to(target):
            raise ValueError(f"Từ chối ghi qua parent symlink ngoài worktree: {destination.parent}")
        while not os.path.lexists(parent):
            parent = parent.parent
        if not parent.is_dir():
            raise ValueError(f"Parent không phải thư mục: {parent}")
        link = str(source) if relative in SHARED_PATHS else os.path.relpath(source, destination.parent)
        plan.append((destination, link))
    return plan


def share_worktree(root, target):
    plan = link_plan(root, target)
    if not plan:
        print(f"Đã dùng đúng nguồn chung: {target}")
        return
    backup = Path(tempfile.mkdtemp(prefix="harness-shared-backup.", dir=target.parent))
    applied = []
    try:
        for destination, link in plan:
            destination.parent.mkdir(parents=True, exist_ok=True)
            original = None
            if os.path.lexists(destination):
                original = backup / destination.relative_to(target)
                original.parent.mkdir(parents=True, exist_ok=True)
                destination.rename(original)
            applied.append((destination, link, original))
            destination.symlink_to(link)
    except Exception as error:
        failures = []
        for destination, link, original in reversed(applied):
            try:
                if os.path.lexists(destination):
                    if not destination.is_symlink() or os.readlink(destination) != link:
                        raise RuntimeError(f"Đích đã đổi trong khi rollback: {destination}")
                    destination.unlink()
                if original is not None:
                    original.rename(destination)
            except Exception as rollback_error:
                failures.append(str(rollback_error))
        detail = "; ".join(failures)
        raise RuntimeError(f"Không nối xong {target}; backup: {backup}. {detail}") from error
    print(f"Đã nối {len(plan)} đường dẫn: {target}")
    print(f"Bản trước chuyển đổi: {backup}")


def excluded_seed_path(relative):
    return any(
        relative == path or relative.startswith(path + "/")
        for path in (*SHARED_PATHS, *LOCAL_LINKS, *PRIVATE_STATE)
    )


def seed_worktree(root, target):
    manifest = root / ".worktreeinclude"
    patterns = [line.strip() for line in manifest.read_text().splitlines() if line.strip() and not line.lstrip().startswith("#")]

    def copy_missing(source, destination):
        if not os.path.lexists(destination):
            shutil.copy2(source, destination)
        return str(destination)

    def ignore(directory, names):
        relative = Path(directory).relative_to(root)
        ignored = []
        for name in names:
            entry = relative / name
            source = root / entry
            destination = target / entry
            if excluded_seed_path(entry.as_posix()) or destination.is_symlink():
                ignored.append(name)
            elif os.path.lexists(destination) and (source.is_symlink() or not source.is_dir() or not destination.is_dir()):
                ignored.append(name)
        return ignored

    for pattern in patterns:
        if Path(pattern).is_absolute() or ".." in Path(pattern).parts:
            raise ValueError(f"Pattern seed không nằm trong repo: {pattern}")
        search = pattern.rstrip("/")
        if search.endswith("/**"):
            search = search[:-3]
        for match in glob.glob(str(root / search), recursive=True):
            source = Path(match)
            relative = source.relative_to(root)
            destination = target / relative
            if excluded_seed_path(relative.as_posix()) or destination.is_symlink():
                continue
            if not destination.parent.resolve().is_relative_to(target):
                raise ValueError(f"Từ chối seed qua parent symlink ngoài worktree: {destination.parent}")
            if source.is_dir():
                if destination.exists() and not destination.is_dir():
                    continue
                shutil.copytree(source, destination, dirs_exist_ok=True, symlinks=True, ignore=ignore, copy_function=copy_missing)
            elif source.is_file() and not os.path.lexists(destination):
                destination.parent.mkdir(parents=True, exist_ok=True)
                copy_missing(source, destination)
    print(f"Đã seed file riêng còn thiếu theo {manifest.name}: {target}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    selection = parser.add_mutually_exclusive_group(required=True)
    selection.add_argument("--all", action="store_true", help="Nối các Treehouse đang tồn tại của repo này.")
    selection.add_argument("--worktree", type=Path, help="Nối một Treehouse đã được Git đăng ký.")
    parser.add_argument("--seed", action="store_true", help="Seed file riêng còn thiếu khi post_create gọi.")
    args = parser.parse_args()
    if args.seed and args.all:
        parser.error("--seed chỉ dùng với --worktree; không seed lại toàn bộ worktree đang có.")
    root = Path(__file__).resolve().parents[2]
    registered = worktrees(root)
    treehouse = (Path.home() / ".treehouse").resolve()
    targets = sorted(path for path in registered if path != root and path.is_dir() and path.is_relative_to(treehouse)) if args.all else [args.worktree.resolve(strict=True)]
    for target in targets:
        validate_worktree(root, target, registered)
        link_plan(root, target)
    for target in targets:
        share_worktree(root, target)
        if args.seed:
            seed_worktree(root, target)
    print(f"Hoàn tất: {len(targets)} Treehouse; không generate profile, không chạy app/build/test.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, ValueError, subprocess.SubprocessError) as error:
        print(f"Không hoàn tất chia sẻ harness: {error}", file=sys.stderr)
        sys.exit(1)
