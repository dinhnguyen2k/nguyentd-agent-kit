import { readFileSync, realpathSync, statSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { matches, readTaskContract, repoPath, validateContractSchema } from './task-contract.mjs';

const schema = JSON.parse(readFileSync(new URL('../contracts/task-manifest.schema.json', import.meta.url), 'utf8'));
const fail = (message) => { throw new Error(message); };

function dispatchBlock(brief) {
  const blocks = [...brief.matchAll(/^```(?:json[ \t]+)?dispatch-contract[ \t]*\r?\n([\s\S]*?)^```[ \t]*\r?$/gm)];
  if (blocks.length !== 1) fail('Main phải giao đúng một block json dispatch-contract, không chỉ mục tiêu hoặc đường dẫn TASK.');
  let value;
  try { value = JSON.parse(blocks[0][1]); } catch { fail('Block dispatch-contract không phải JSON hợp lệ.'); }
  return value;
}

function canonicalContract(root, brief) {
  if (!/^contract_(?:ref|version):/m.test(brief)) return null;
  const refs = [...brief.matchAll(/^contract_ref:[ \t]*(\S+)[ \t]*\r?$/gm)];
  const versions = [...brief.matchAll(/^contract_version:[ \t]*([1-9]\d*)[ \t]*\r?$/gm)];
  if (refs.length !== 1 || versions.length !== 1) fail('TASK cần một contract_ref và contract_version tường minh.');
  const contract = readTaskContract(root, refs[0][1]);
  if (contract.mode !== 'implementation') fail('Dispatch lane viết code cần TASK mode implementation.');
  if (contract.contract_version !== Number(versions[0][1])) fail('contract_version trong assignment không khớp TASK.');
  if (!contract.execution) fail('TASK chưa có execution đã chốt; Main bổ sung và cập nhật version trước dispatch.');
  return contract;
}

function checkEvidence(root, reference, lineCounts, sourcePaths) {
  const match = reference.match(/^(.+):([1-9]\d*)(?:-([1-9]\d*))?$/);
  if (!match) fail(`Evidence phải là path:line hoặc path:start-end: ${reference}`);
  const [, path, first, last] = match;
  const start = Number(first);
  const end = last === undefined ? start : Number(last);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end < start) fail(`Khoảng dòng evidence không hợp lệ: ${reference}`);
  if (sourcePaths && !sourcePaths.some((input) => matches(path, input))) fail(`Evidence chưa nằm trong source_paths của TASK: ${path}`);
  if (!lineCounts.has(path)) {
    const absolute = repoPath(root, path, true, { allowSharedRead: true });
    if (!statSync(absolute).isFile()) fail(`Evidence phải trỏ tới file: ${path}`);
    const source = readFileSync(absolute, 'utf8');
    lineCounts.set(path, source.length === 0 ? 0 : source.split('\n').length - Number(source.endsWith('\n')));
  }
  const lineCount = lineCounts.get(path);
  if (start > Math.max(lineCount, 1) || end > lineCount + (lineCount > 0 ? 1 : 0)) {
    fail(`Evidence vượt số dòng source: ${reference}; ${path} có ${lineCount} dòng.`);
  }
}

function contractDispatch(contract) {
  return {
    allowed_paths: contract.allowed_paths,
    ...contract.execution,
    acceptance: contract.acceptance,
    permitted_checks: contract.permitted_checks,
  };
}

/** Kiểm tra đủ dữ kiện và liên kết source, không thay Main chứng minh nghiệp vụ. */
export function validateDispatchContract(repoRoot, brief) {
  const root = realpathSync(repoRoot);
  const dispatch = dispatchBlock(brief);
  const contract = canonicalContract(root, brief);
  return validateDispatch(root, dispatch, contract);
}

/** Trích brief từ TASK đã ghim version, không để model chép lại recipe canonical. */
export function prepareDispatchAssignment(repoRoot, brief) {
  const root = realpathSync(repoRoot);
  const contract = canonicalContract(root, brief);
  const hasExplicitFence = /^```(?:json[ \t]+)?dispatch-contract[ \t]*\r?$/m.test(brief);
  if (contract && !hasExplicitFence) {
    const extraLines = brief
      .trim()
      .split(/\r?\n/)
      .filter((line) => line.trim() !== '' && !/^contract_(?:ref|version):[ \t]*\S+[ \t]*$/.test(line));
    const extraNote = extraLines.join('\n').trim();
    if (extraNote.length > 800) {
      fail('Ghi chú phụ đi kèm contract_ref quá dài (>800 ký tự); mọi yêu cầu thực thi phải nằm trong TASK canonical.');
    }
    const dispatch = validateDispatch(root, contractDispatch(contract), contract);
    const prefix = extraNote
      ? `contract_ref: ${contract.contract_ref}\ncontract_version: ${contract.contract_version}\n\n${extraNote}`
      : `contract_ref: ${contract.contract_ref}\ncontract_version: ${contract.contract_version}`;
    return `${prefix}\n\n\`\`\`json dispatch-contract\n${JSON.stringify(dispatch, null, 2)}\n\`\`\``;
  }
  validateDispatch(root, dispatchBlock(brief), contract);
  return brief;
}

function validateDispatch(root, dispatch, contract) {
  validateContractSchema(dispatch, schema.$defs.dispatch, 'dispatch');
  if (contract && !isDeepStrictEqual(dispatch, contractDispatch(contract))) fail('Block dispatch-contract phải trích đúng execution, scope, acceptance và checks của TASK hiện hành.');
  for (const path of dispatch.allowed_paths) repoPath(root, path, false);
  const lineCounts = new Map();
  for (const change of dispatch.changes) {
    if (/[?*]/.test(change.file)) fail(`Điểm sửa phải là file cụ thể, không phải glob: ${change.file}`);
    repoPath(root, change.file, false);
    if (!dispatch.allowed_paths.some((input) => matches(change.file, input))) fail(`Điểm sửa nằm ngoài allowed_paths: ${change.file}`);
    for (const reference of change.evidence) checkEvidence(root, reference, lineCounts, contract?.source_paths);
  }
  return dispatch;
}
