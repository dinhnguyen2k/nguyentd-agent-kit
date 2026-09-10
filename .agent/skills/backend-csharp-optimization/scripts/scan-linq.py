#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime

BACKEND_SRC = 'backend/src'
SKIP_DIR_NAMES = ('bin', 'obj', 'Migrations')

# Định nghĩa các mẫu Regex quét lỗi
# 1. Phát hiện Select ToString trước Distinct
SELECT_TOSTRING_DISTINCT = re.compile(r'\.Select\s*\(\s*(\w+)\s*=>\s*(.+?)\.ToString\(\)\s*\)\s*\.Distinct\s*\(', re.DOTALL)

# 2. Phát hiện Contains trên List thay vì HashSet đối với biến Ids/Keys
CONTAINS_USAGE = re.compile(r'(\w+Ids|\w+Keys)\.Contains\s*\(')

# 3. Phát hiện FirstOrDefault / Any bên trong vòng lặp foreach (Anti-pattern thay cho Dictionary)
FOREACH_HEADER = re.compile(r'foreach\s*\(\s*var\s+(\w+)\s+in\s+(.+?)\)\s*\{', re.DOTALL)
LOOP_FIRST_OR_DEFAULT = re.compile(r'\.\s*(FirstOrDefault|Any|Where)\s*\(\s*\w+\s*=>\s*\w+\.(Id|FinishedGoodId|Code)\s*==', re.DOTALL)

# 5. Quét Lỗi 5: dictionary.Keys.Contains(key) (Rule 9.1)
KEYS_CONTAINS = re.compile(r'(\w+)\.Keys\.Contains\s*\(')

# 6. Quét Lỗi 6: ContainsKey + Indexer (Rule 9.2)
CONTAINS_KEY = re.compile(r'(\w+)\.ContainsKey\s*\(\s*([^)]+?)\s*\)')

# 7. Quét Lỗi 7: !ContainsKey + Add (Rule 10)
CONTAINS_KEY_NOT = re.compile(r'!\s*(\w+)\.ContainsKey\s*\(\s*([^)]+?)\s*\)')


def to_rel_path(path, workspace_root):
    return os.path.relpath(path, workspace_root).replace('\\', '/')


def line_number_from_pos(content, pos):
    return content.count('\n', 0, pos) + 1


def extract_statement(content, start_pos, max_len=260):
    end_pos = content.find(';', start_pos)
    if end_pos == -1:
        end_pos = min(len(content), start_pos + max_len)
    snippet = content[start_pos:end_pos].strip()
    return re.sub(r'\s+', ' ', snippet)


def build_list_declarations(content):
    declarations = {}
    # Bắt var/list declaration theo statement đầy đủ để hỗ trợ multi-line.
    pattern = re.compile(r'\b(?:var|List<[^>]+>)\s+(\w+)\s*=\s*(.*?);', re.DOTALL)
    for match in pattern.finditer(content):
        var_name = match.group(1)
        assigned_expr = match.group(2)
        if '.ToList(' in assigned_expr or '.ToList()' in assigned_expr:
            declarations[var_name] = line_number_from_pos(content, match.start())
    return declarations


def iter_foreach_blocks(content):
    for header_match in FOREACH_HEADER.finditer(content):
        open_brace_pos = content.find('{', header_match.end() - 1)
        if open_brace_pos == -1:
            continue

        depth = 0
        close_brace_pos = -1
        for i in range(open_brace_pos, len(content)):
            char = content[i]
            if char == '{':
                depth += 1
            elif char == '}':
                depth -= 1
                if depth == 0:
                    close_brace_pos = i
                    break

        if close_brace_pos == -1:
            continue

        loop_var = header_match.group(1)
        collection_var = header_match.group(2).strip()
        body_start = open_brace_pos + 1
        body = content[body_start:close_brace_pos]
        yield loop_var, collection_var, body, body_start


def dedupe_errors(errors):
    deduped = []
    seen = set()
    for err in sorted(errors, key=lambda x: x.get('line', 0)):
        key = (err.get('line'), err.get('msg'), err.get('code'))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(err)
    return deduped


def scan_select_tostring_distinct(content):
    errors = []
    for match in SELECT_TOSTRING_DISTINCT.finditer(content):
        lambda_param = match.group(1)
        source_expr = re.sub(r'\s+', ' ', match.group(2)).strip()
        fix_suggestion = (
            f"Thay đổi thành: .Select({lambda_param} => {source_expr}).Distinct().Select(id => id.ToString())"
        )
        errors.append({
            "line": line_number_from_pos(content, match.start()),
            "msg": "Lỗi tối ưu RAM/CPU: Gọi ToString() trước Distinct() trên tập dữ liệu gây lãng phí bộ nhớ Heap và làm chậm phép so sánh. Hãy đảo Distinct() lên trước Select().",
            "code": extract_statement(content, match.start()),
            "fix": fix_suggestion
        })
    return errors


def scan_list_contains_lookup(content, list_vars):
    errors = []
    for match in CONTAINS_USAGE.finditer(content):
        var_name = match.group(1)
        if var_name not in list_vars:
            continue
        errors.append({
            "line": line_number_from_pos(content, match.start()),
            "msg": f"Lỗi tối ưu RAM/CPU: Biến '{var_name}' được khai báo dạng List (dòng {list_vars[var_name]}) nhưng lại dùng để lookup bằng '.Contains()'. Hãy chuyển khai báo sang '.ToHashSet()' để tối ưu O(1) tra cứu.",
            "code": extract_statement(content, match.start()),
            "fix": f"Sửa dòng {list_vars[var_name]}: Thay đổi '.ToList();' thành '.ToHashSet();'"
        })
    return errors


def scan_foreach_lookup_antipattern(content):
    errors = []
    for _, _, body, body_start in iter_foreach_blocks(content):
        nested_match = LOOP_FIRST_OR_DEFAULT.search(body)
        if not nested_match:
            continue
        absolute_pos = body_start + nested_match.start()
        errors.append({
            "line": line_number_from_pos(content, absolute_pos),
            "msg": "Lỗi thuật toán O(N*M): Dùng FirstOrDefault / Any để tìm kiếm con trong vòng lặp foreach. Hãy chuyển danh sách đích về Dictionary (ToDictionary) ở ngoài vòng lặp để tra cứu O(1) bằng TryGetValue.",
            "code": extract_statement(content, absolute_pos),
            "fix": "Sử dụng ToDictionary(x => x.Id, x => x) ngoài vòng lặp và dùng TryGetValue bên trong."
        })
    return errors


def scan_select_tolist_on_list(content, list_vars_all):
    errors = []
    for var_name, decl_line in list_vars_all.items():
        select_pattern = re.compile(rf'\b{re.escape(var_name)}\.Select\s*\(', re.DOTALL)
        for match in select_pattern.finditer(content):
            start_pos = match.start()
            statement = extract_statement(content, start_pos, max_len=420)
            if '.ToList(' not in statement and '.ToList()' not in statement:
                continue
            errors.append({
                "line": line_number_from_pos(content, start_pos),
                "msg": f"Khuyến nghị tối ưu (RCS1077): Biến '{var_name}' là List (khai báo dòng {decl_line}) đang dùng '.Select(...).ToList()'. Ưu tiên dùng '.ConvertAll(...)' trong các hot path, batch/import lớn để tránh allocate iterator và có sẵn capacity tối ưu.",
                "code": statement,
                "fix": f"Thay đổi '{var_name}.Select(...).ToList()' thành '{var_name}.ConvertAll(...)'"
            })
    return errors


def scan_dictionary_keys_contains(content):
    errors = []
    for match in KEYS_CONTAINS.finditer(content):
        dict_name = match.group(1)
        errors.append({
            "line": line_number_from_pos(content, match.start()),
            "msg": f"Lỗi tối ưu Dictionary (Rule 9.1): Sử dụng '{dict_name}.Keys.Contains(key)' gây lãng phí allocation và tìm kiếm O(N). Hãy thay thế bằng '{dict_name}.ContainsKey(key)'.",
            "code": extract_statement(content, match.start()),
            "fix": f"Thay thế bằng '{dict_name}.ContainsKey(key)'"
        })
    return errors


def scan_contains_key_then_indexer(content):
    errors = []
    for match in CONTAINS_KEY.finditer(content):
        dict_name = match.group(1)
        key_name = match.group(2).strip()
        start_pos = match.start()
        lookahead = content[start_pos:start_pos + 180]
        norm_lookahead = re.sub(r'\s+', '', lookahead)
        norm_target = f"{dict_name}[{re.sub(r'\\s+', '', key_name)}]"
        if norm_target not in norm_lookahead:
            continue
        errors.append({
            "line": line_number_from_pos(content, start_pos),
            "msg": "Lỗi tối ưu Dictionary (Rule 9.2): Sử dụng 'ContainsKey' rồi truy cập qua indexer '[key]' làm lookup key đến 2 lần. Hãy thay thế bằng '.TryGetValue(...)'.",
            "code": extract_statement(content, start_pos),
            "fix": f"Sử dụng {dict_name}.TryGetValue({key_name}, out var value)"
        })
    return errors


def scan_not_contains_then_add(content):
    errors = []
    for match in CONTAINS_KEY_NOT.finditer(content):
        dict_name = match.group(1)
        key_name = match.group(2).strip()
        start_pos = match.start()
        lookahead = content[start_pos:start_pos + 180]
        if f"{dict_name}.Add(" not in lookahead:
            continue
        errors.append({
            "line": line_number_from_pos(content, start_pos),
            "msg": "Lỗi tối ưu Dictionary (Rule 10): Sử dụng '!ContainsKey' rồi mới 'Add' làm lookup key 2 lần. Hãy thay thế bằng '.TryAdd(...)'.",
            "code": extract_statement(content, start_pos),
            "fix": f"Sử dụng {dict_name}.TryAdd({key_name}, value)"
        })
    return errors


def scan_any_on_list(content, list_vars_all):
    errors = []
    for var_name, decl_line in list_vars_all.items():
        for match in re.finditer(rf'\b{var_name}\.Any\s*\(\s*\)', content):
            start_pos = match.start()
            errors.append({
                "line": line_number_from_pos(content, start_pos),
                "msg": f"Khuyến nghị tối ưu (Rule 3 - Case 2): Biến '{var_name}' là List (khai báo dòng {decl_line}) nhưng lại dùng '.Any()'. Hãy thay thế bằng '.Count > 0' để tránh tạo IEnumerator allocations.",
                "code": f"{var_name}.Any()",
                "fix": f"Thay đổi thành '{var_name}.Count > 0'"
            })
    return errors


def find_solution_file(workspace_root):
    preferred = os.path.join(workspace_root, 'backend', 'CogainSolution.sln')
    if os.path.exists(preferred):
        return preferred

    backend_root = os.path.join(workspace_root, 'backend')
    if not os.path.exists(backend_root):
        return None

    for root, _, files in os.walk(backend_root):
        for filename in files:
            if filename.endswith('.sln'):
                return os.path.join(root, filename)

    return None


def cleanup_unused_usings(workspace_root, files):
    solution_file = find_solution_file(workspace_root)
    if solution_file is None:
        return False, 'Không tìm thấy file .sln để chạy dotnet format (remove unused using).'

    if not files:
        return True, 'Không có file để cleanup unused using.'

    solution_dir = os.path.dirname(solution_file)
    include_paths = [
        os.path.relpath(path, solution_dir).replace('\\', '/')
        for path in files
    ]

    command = [
        'dotnet', 'format', solution_file,
        '--include', *include_paths,
        '--diagnostics', 'IDE0005',
        '--severity', 'warn',
        '--verbosity', 'minimal',
    ]

    try:
        result = subprocess.run(
            command,
            cwd=solution_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )
    except Exception as ex:
        return False, f'Lỗi chạy dotnet format: {ex}'

    output = '\n'.join([result.stdout.strip(), result.stderr.strip()]).strip()
    if result.returncode == 0:
        return True, output or 'Đã cleanup unused using (IDE0005) thành công.'

    return False, output or f'dotnet format trả về mã {result.returncode}.'

def scan_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return [{"line": 0, "msg": f"Không thể đọc file: {e}", "fix": "N/A", "code": "N/A"}]

    list_vars_all = build_list_declarations(content)
    list_vars = {
        name: line
        for name, line in list_vars_all.items()
        if name.endswith(('Ids', 'Keys'))
    }

    errors = []
    errors.extend(scan_select_tostring_distinct(content))
    errors.extend(scan_list_contains_lookup(content, list_vars))
    errors.extend(scan_foreach_lookup_antipattern(content))
    errors.extend(scan_select_tolist_on_list(content, list_vars_all))
    errors.extend(scan_dictionary_keys_contains(content))
    errors.extend(scan_contains_key_then_indexer(content))
    errors.extend(scan_not_contains_then_add(content))
    errors.extend(scan_any_on_list(content, list_vars_all))

    return dedupe_errors(errors)


def run_git_command(workspace_root, args):
    try:
        result = subprocess.run(
            ['git', '-C', workspace_root] + args,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            return []
        return [line.strip() for line in result.stdout.splitlines() if line.strip()]
    except Exception:
        return []


def get_all_cs_files(src_dir):
    files = []
    for root, _, filenames in os.walk(src_dir):
        if any(name in root for name in SKIP_DIR_NAMES):
            continue
        for filename in filenames:
            if filename.endswith('.cs'):
                files.append(os.path.normpath(os.path.join(root, filename)))
    return sorted(files)


def get_changed_cs_files(workspace_root):
    candidates = set()
    git_lists = []
    git_lists.extend(run_git_command(workspace_root, ['diff', '--name-only', '--diff-filter=ACMRTUXB', '--', BACKEND_SRC]))
    git_lists.extend(run_git_command(workspace_root, ['diff', '--cached', '--name-only', '--diff-filter=ACMRTUXB', '--', BACKEND_SRC]))
    git_lists.extend(run_git_command(workspace_root, ['ls-files', '--others', '--exclude-standard', BACKEND_SRC]))

    for rel in git_lists:
        if not rel.endswith('.cs'):
            continue
        abs_path = os.path.normpath(os.path.join(workspace_root, rel))
        if os.path.exists(abs_path):
            candidates.add(abs_path)

    return sorted(candidates)


def resolve_files_arg(workspace_root, files):
    resolved = []
    for f in files:
        abs_path = f if os.path.isabs(f) else os.path.join(workspace_root, f)
        abs_path = os.path.normpath(abs_path)
        if not abs_path.endswith('.cs'):
            continue
        if not os.path.exists(abs_path):
            continue
        resolved.append(abs_path)
    return sorted(set(resolved))


def parse_args():
    parser = argparse.ArgumentParser(
        description='Quét lỗi tối ưu LINQ/Collection cho C# trong backend/src với phạm vi linh hoạt.'
    )
    parser.add_argument('--all', action='store_true', help='Quét toàn bộ backend/src (legacy mode).')
    parser.add_argument('--files', nargs='+', help='Chỉ quét các file C# chỉ định (đường dẫn tương đối hoặc tuyệt đối).')
    parser.add_argument('--report-file', default='.agent/reports/scan-linq-report.txt', help='Đường dẫn file report đầu ra.')
    parser.add_argument('--report-format', choices=['text', 'json'], default='text', help='Định dạng report: text hoặc json.')
    parser.add_argument('--no-report', action='store_true', help='Không ghi report ra file, chỉ in console.')
    parser.add_argument('--cleanup-unused-usings', action='store_true', help='Tự động remove unused using (IDE0005) cho đúng các file đang quét.')
    return parser.parse_args()


def resolve_targets(args, workspace_root, src_dir):
    if args.files:
        return 'files', resolve_files_arg(workspace_root, args.files)
    if args.all:
        return 'all', get_all_cs_files(src_dir)
    return 'changed', get_changed_cs_files(workspace_root)


def normalize_report_path(workspace_root, report_path):
    if os.path.isabs(report_path):
        return report_path
    return os.path.join(workspace_root, report_path)


def handle_empty_targets(args, workspace_root, mode):
    print('ℹ️ Không có file C# phù hợp để quét trong phạm vi hiện tại.')
    if args.no_report:
        return
    report_path = normalize_report_path(workspace_root, args.report_file)
    write_report(report_path, args.report_format, mode, workspace_root, [])
    print(f"📝 Đã ghi report: {to_rel_path(report_path, workspace_root)}")


def scan_targets(workspace_root, target_files):
    files_with_errors = 0
    total_errors = 0
    results = []

    for filepath in target_files:
        rel_path = to_rel_path(filepath, workspace_root)
        file_errors = scan_file(filepath)
        results.append({'file': filepath, 'errors': file_errors})

        if not file_errors:
            continue

        files_with_errors += 1
        total_errors += len(file_errors)
        print(f"\n⚠️ File: {rel_path}")
        for err in file_errors:
            print(f"  [Dòng {err['line']}]: {err['msg']}")
            print(f"    Code: {err['code']}")
            print(f"    Sửa:  {err['fix']}")

    return files_with_errors, total_errors, results


def print_summary(total_files, total_errors, files_with_errors, report_path, workspace_root, write_report_enabled):
    print("\n" + "=" * 80)
    if write_report_enabled:
        print(f"📝 Report: {to_rel_path(report_path, workspace_root)}")

    if total_errors > 0:
        print(f"❌ Hoàn tất! Quét {total_files} file C#, phát hiện {total_errors} lỗi LINQ tại {files_with_errors} file.")
        print("💡 Vui lòng sửa các lỗi trên theo quy chuẩn backend-csharp-optimization để đảm bảo chất lượng code sạch và tối ưu RAM.")
        return 1

    print(f"✅ Hoàn tất! Đã quét {total_files} file C#. Không phát hiện vi phạm nào. Code của anh sạch và tối ưu hoàn hảo!")
    return 0


def build_text_report(mode, workspace_root, results):
    total_files = len(results)
    files_with_errors = sum(1 for item in results if item['errors'])
    total_errors = sum(len(item['errors']) for item in results)

    lines = []
    lines.append(f"scan-linq report | time={datetime.now().isoformat(timespec='seconds')}")
    lines.append(f"mode={mode} | scanned_files={total_files} | files_with_errors={files_with_errors} | total_errors={total_errors}")
    lines.append('=' * 80)

    for item in results:
        rel_path = to_rel_path(item['file'], workspace_root)
        if not item['errors']:
            continue
        lines.append(f"\\nFile: {rel_path}")
        for err in item['errors']:
            lines.append(f"  [Line {err['line']}] {err['msg']}")
            lines.append(f"    Code: {err['code']}")
            lines.append(f"    Fix:  {err['fix']}")

    if total_errors == 0:
        lines.append("\\nNo violations found.")

    return '\n'.join(lines) + '\n'


def write_report(report_path, report_format, mode, workspace_root, results):
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    if report_format == 'json':
        payload = {
            'time': datetime.now().isoformat(timespec='seconds'),
            'mode': mode,
            'summary': {
                'scanned_files': len(results),
                'files_with_errors': sum(1 for item in results if item['errors']),
                'total_errors': sum(len(item['errors']) for item in results),
            },
            'files': [
                {
                    'file': to_rel_path(item['file'], workspace_root),
                    'errors': item['errors'],
                }
                for item in results
            ],
        }
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        return

    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(build_text_report(mode, workspace_root, results))

def main():
    args = parse_args()

    # Thư mục gốc mặc định là cwd hiện tại.
    workspace_root = os.getcwd()
    src_dir = os.path.join(workspace_root, 'backend', 'src')

    if not os.path.exists(src_dir):
        print(f"❌ Không tìm thấy thư mục backend/src tại: {src_dir}")
        sys.exit(1)

    mode, target_files = resolve_targets(args, workspace_root, src_dir)

    print(f"🔍 Bắt đầu quét lỗi LINQ & Collection Optimization (mode={mode})...")

    if not target_files:
        handle_empty_targets(args, workspace_root, mode)
        sys.exit(0)

    if args.cleanup_unused_usings:
        ok, cleanup_message = cleanup_unused_usings(workspace_root, target_files)
        status_label = '✅' if ok else '⚠️'
        print(f"{status_label} Cleanup unused usings: {cleanup_message}")

    total_files = len(target_files)
    files_with_errors, total_errors, results = scan_targets(workspace_root, target_files)

    report_path = normalize_report_path(workspace_root, args.report_file)

    if not args.no_report:
        write_report(report_path, args.report_format, mode, workspace_root, results)

    exit_code = print_summary(
        total_files,
        total_errors,
        files_with_errors,
        report_path,
        workspace_root,
        not args.no_report,
    )
    sys.exit(exit_code)

if __name__ == '__main__':
    main()
