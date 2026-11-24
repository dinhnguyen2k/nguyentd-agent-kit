export const TOOLS = [
  {
    name: "find_definition",
    description:
      "Find the definition of a symbol by name (and optional 1-based line) in a file. Returns definitions for matching symbols.",
    inputSchema: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "The path to the file" },
        symbol_name: { type: "string", description: "The name of the symbol" },
        symbol_kind: { type: "string", description: "The kind of symbol (function, class, variable, method, etc.)" },
        line: { type: "number", description: "Optional 1-based line number to disambiguate or locate local symbols" },
      },
      required: ["file_path", "symbol_name"],
    },
  },
  {
    name: "find_references",
    description:
      "Find all references to a symbol across the entire workspace. Returns references for matching symbols.",
    inputSchema: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "The path to the file where the symbol is referenced or defined" },
        symbol_name: { type: "string", description: "The name of the symbol" },
        symbol_kind: { type: "string", description: "The kind of symbol (function, class, variable, method, etc.)" },
        line: { type: "number", description: "Optional 1-based line number to disambiguate or locate local symbols" },
        include_declaration: { type: "boolean", description: "Whether to include the declaration", default: true },
      },
      required: ["file_path", "symbol_name"],
    },
  },
  {
    name: "rename_symbol",
    description:
      "Rename a symbol by name and kind in a file. Use dry_run to preview changes without applying them.",
    inputSchema: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "The path to the file" },
        symbol_name: { type: "string", description: "The name of the symbol" },
        symbol_kind: { type: "string", description: "The kind of symbol (function, class, variable, method, etc.)" },
        new_name: { type: "string", description: "The new name for the symbol" },
        dry_run: { type: "boolean", description: "Preview changes without applying them (default: false)" },
      },
      required: ["file_path", "symbol_name", "new_name"],
    },
  },
  {
    name: "rename_symbol_strict",
    description:
      "Rename a symbol at a specific 1-based line and character position in a file.",
    inputSchema: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "The path to the file" },
        line: { type: "number", description: "The line number (1-indexed)" },
        character: { type: "number", description: "The character position in the line (1-indexed)" },
        new_name: { type: "string", description: "The new name for the symbol" },
        dry_run: { type: "boolean", description: "Preview changes without applying them (default: false)" },
      },
      required: ["file_path", "line", "character", "new_name"],
    },
  },
  {
    name: "get_diagnostics",
    description:
      "Get live language diagnostics (errors, warnings, hints) synced with the latest file content on disk.",
    inputSchema: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "The path to the file to get diagnostics for" },
      },
      required: ["file_path"],
    },
  },
  {
    name: "restart_server",
    description:
      "Manually restart LSP servers. Can restart servers for specific file extensions or all running servers.",
    inputSchema: {
      type: "object",
      properties: {
        extensions: {
          type: "array",
          items: { type: "string" },
          description: 'Array of file extensions to restart servers for (e.g., ["ts", "tsx"]).',
        },
      },
    },
  },
  {
    name: "get_hover",
    description: "Get hover information (documentation, type info) for a symbol at a 1-based position in a file.",
    inputSchema: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "The path to the file" },
        line: { type: "number", description: "The line number (1-indexed)" },
        character: { type: "number", description: "The character position in the line (1-indexed)" },
      },
      required: ["file_path", "line", "character"],
    },
  },
  {
    name: "find_workspace_symbols",
    description: "Search for symbols across all active language servers in the workspace by name.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The symbol name or pattern to search for" },
      },
      required: ["query"],
    },
  },
  {
    name: "find_implementation",
    description: "Find implementations of an interface or abstract method at a 1-based position.",
    inputSchema: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "The path to the file" },
        line: { type: "number", description: "The line number (1-indexed)" },
        character: { type: "number", description: "The character position in the line (1-indexed)" },
      },
      required: ["file_path", "line", "character"],
    },
  },
  {
    name: "prepare_call_hierarchy",
    description: "Get call hierarchy item at a 1-based position.",
    inputSchema: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "The path to the file" },
        line: { type: "number", description: "The line number (1-indexed)" },
        character: { type: "number", description: "The character position in the line (1-indexed)" },
      },
      required: ["file_path", "line", "character"],
    },
  },
  {
    name: "get_incoming_calls",
    description: "Find all functions/methods that call the function at a 1-based position.",
    inputSchema: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "The path to the file" },
        line: { type: "number", description: "The line number (1-indexed)" },
        character: { type: "number", description: "The character position in the line (1-indexed)" },
      },
      required: ["file_path", "line", "character"],
    },
  },
  {
    name: "get_outgoing_calls",
    description: "Find all functions/methods called by the function at a 1-based position.",
    inputSchema: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "The path to the file" },
        line: { type: "number", description: "The line number (1-indexed)" },
        character: { type: "number", description: "The character position in the line (1-indexed)" },
      },
      required: ["file_path", "line", "character"],
    },
  },
];
