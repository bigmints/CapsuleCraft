//! Model Context Protocol (MCP) server over stdin/stdout for CapsuleCraft.
//!
//! Exposes the RFC 5322 .eml vault to AI agents (Antigravity, Claude Code,
//! Claude Desktop, Cursor, Windsurf) as a local Second Brain.
//!
//! Protocol: JSON-RPC 2.0 line-delimited over stdio.

use std::collections::HashMap;
use std::io::{self, BufRead, Write};
use std::path::{Path, PathBuf};

use serde_json::{json, Value};

use crate::cli::Launch;
use crate::links;
use crate::mime::{new_block_id, Capsule};
use crate::search::{self, Bm25Index};
use crate::vault::{default_vault_dir, Vault};

pub const MCP_PROTOCOL_VERSION: &str = "2024-11-05";
pub const SERVER_NAME: &str = "capsulecraft-mcp";
pub const SERVER_VERSION: &str = "1.5.0";

/// Generate the MCP client configuration snippet.
pub fn mcp_config_json(exe_path: &Path, _vault_dir: &Path) -> Value {
    let exe_str = exe_path.to_string_lossy().to_string();

    json!({
        "mcpServers": {
            "capsulecraft": {
                "command": exe_str,
                "args": ["--mcp"]
            }
        }
    })
}

/// Print MCP configuration snippets for various clients and exit.
pub fn print_config(launch: &Launch) {
    let exe = std::env::current_exe()
        .unwrap_or_else(|_| PathBuf::from("capsuleos-native.exe"));
    let vault = launch.vault.clone().unwrap_or_else(crate::vault::get_active_vault_dir);
    let cfg = mcp_config_json(&exe, &vault);

    println!("=== CapsuleCraft MCP Server Configuration ===");
    println!();
    println!("Executable : {}", exe.display());
    println!("Active vault : {}", vault.display());
    println!();
    println!("--- JSON Configuration (Claude Desktop / Antigravity / Cursor) ---");
    println!("{}", serde_json::to_string_pretty(&cfg).unwrap_or_default());
    println!();
    println!("--- Claude Code CLI Command ---");
    println!(
        "claude mcp add capsulecraft \"{}\" --mcp",
        exe.display()
    );
    println!();
}

/// List of tools exposed by the MCP server.
pub fn tool_definitions() -> Value {
    json!([
        {
            "name": "capsule_list",
            "description": "List all capsules in the CapsuleCraft vault with metadata (Message-ID, subject, author, date, tags, filename, parent_id).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "tag": {
                        "type": "string",
                        "description": "Optional tag filter (e.g. 'project', 'architecture', 'decision')"
                    }
                }
            }
        },
        {
            "name": "capsule_read",
            "description": "Read a full capsule by its Message-ID, file name, or page subject. Returns full plain text content, structured blocks, headers, and attachment information.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "id": {
                        "type": "string",
                        "description": "Message-ID (e.g. <alpha@vault.local>), file name (e.g. capsule_1.eml), or page title"
                    }
                },
                "required": ["id"]
            }
        },
        {
            "name": "capsule_search",
            "description": "Ranked Okapi BM25 search across all capsules in the vault, returning top matching pages with highlighted text snippets.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query terms (supports English and Russian stem/words)"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of results to return (default: 10)"
                    }
                },
                "required": ["query"]
            }
        },
        {
            "name": "capsule_create",
            "description": "Create a new capsule (.eml) in the vault with structured blocks (paragraphs, callout boxes, todo checklists, and optional parent page relation).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "subject": {
                        "type": "string",
                        "description": "Title/subject of the new capsule"
                    },
                    "content": {
                        "type": "string",
                        "description": "Main body text (will be broken into paragraphs)"
                    },
                    "author": {
                        "type": "string",
                        "description": "Author name or identifier (defaults to 'AI Agent')"
                    },
                    "tags": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "List of tags to assign (e.g. ['ai', 'research'])"
                    },
                    "parent_id": {
                        "type": "string",
                        "description": "Optional parent capsule Message-ID to place this under"
                    },
                    "callouts": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "text": { "type": "string" },
                                "tone": {
                                    "type": "string",
                                    "enum": ["emerald", "amber", "rose", "indigo"],
                                    "description": "Tone of callout box: emerald (success/highlight), amber (warning), rose (risk), indigo (info)"
                                }
                            },
                            "required": ["text"]
                        },
                        "description": "Optional highlighted callout boxes"
                    },
                    "todos": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "Optional actionable todo/checklist items"
                    }
                },
                "required": ["subject"]
            }
        },
        {
            "name": "capsule_reply",
            "description": "Add a reply to an existing capsule thread, establishing RFC 5322 In-Reply-To and References relationships.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "parent_id": {
                        "type": "string",
                        "description": "Message-ID or file name of the capsule being replied to"
                    },
                    "content": {
                        "type": "string",
                        "description": "Body text of the reply"
                    },
                    "subject": {
                        "type": "string",
                        "description": "Reply subject (defaults to 'Re: <parent subject>')"
                    },
                    "author": {
                        "type": "string",
                        "description": "Author name (defaults to 'AI Opponent')"
                    }
                },
                "required": ["parent_id", "content"]
            }
        }
    ])
}

/// Handler for the MCP JSON-RPC protocol.
pub struct McpHandler {
    pub vault: Vault,
    pub vault_override: Option<PathBuf>,
}

impl McpHandler {
    pub fn new(vault_override: Option<PathBuf>) -> Self {
        let dir = vault_override
            .clone()
            .unwrap_or_else(crate::vault::get_active_vault_dir);
        let vault = Vault::load(dir);
        Self {
            vault,
            vault_override,
        }
    }

    /// Reload the vault from disk to reflect any concurrent edits or active folder switches.
    pub fn reload(&mut self) {
        if let Some(fixed) = &self.vault_override {
            if self.vault.dir != *fixed {
                self.vault = Vault::load(fixed.clone());
            } else {
                self.vault.reload();
            }
        } else {
            let active = crate::vault::get_active_vault_dir();
            if self.vault.dir != active {
                eprintln!("[capsulecraft-mcp] Active vault changed to: {}", active.display());
                self.vault = Vault::load(active);
            } else {
                self.vault.reload();
            }
        }
    }

    /// Process a single JSON-RPC request and return an optional response JSON-RPC string.
    pub fn handle_message(&mut self, line: &str) -> Option<String> {
        let req: Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(err) => {
                let err_resp = json!({
                    "jsonrpc": "2.0",
                    "id": Value::Null,
                    "error": {
                        "code": -32700,
                        "message": format!("Parse error: {err}")
                    }
                });
                return Some(err_resp.to_string());
            }
        };

        let method = match req.get("method").and_then(Value::as_str) {
            Some(m) => m,
            None => return None,
        };

        let id = req.get("id").cloned();

        // Notifications have no id and expect no response
        if id.is_none() {
            if method == "notifications/initialized" {
                eprintln!("[capsulecraft-mcp] Client initialized notification received.");
            }
            return None;
        }

        let id = id.unwrap();
        let params = req.get("params").cloned().unwrap_or(Value::Null);

        let response = match method {
            "initialize" => {
                json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "result": {
                        "protocolVersion": MCP_PROTOCOL_VERSION,
                        "capabilities": {
                            "tools": {},
                            "resources": {}
                        },
                        "serverInfo": {
                            "name": SERVER_NAME,
                            "version": SERVER_VERSION
                        }
                    }
                })
            }
            "ping" => {
                json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "result": {}
                })
            }
            "tools/list" => {
                json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "result": {
                        "tools": tool_definitions()
                    }
                })
            }
            "tools/call" => {
                let tool_name = params.get("name").and_then(Value::as_str).unwrap_or("");
                let arguments = params.get("arguments").cloned().unwrap_or(json!({}));
                let result = self.call_tool(tool_name, &arguments);
                match result {
                    Ok(val) => {
                        json!({
                            "jsonrpc": "2.0",
                            "id": id,
                            "result": {
                                "content": [
                                    {
                                        "type": "text",
                                        "text": serde_json::to_string_pretty(&val).unwrap_or_else(|_| val.to_string())
                                    }
                                ],
                                "isError": false
                            }
                        })
                    }
                    Err(err_msg) => {
                        json!({
                            "jsonrpc": "2.0",
                            "id": id,
                            "result": {
                                "content": [
                                    {
                                        "type": "text",
                                        "text": err_msg
                                    }
                                ],
                                "isError": true
                            }
                        })
                    }
                }
            }
            "resources/list" => {
                self.reload();
                let resources: Vec<Value> = self
                    .vault
                    .capsules
                    .iter()
                    .map(|c| {
                        json!({
                            "uri": format!("capsule://{}", c.file_name),
                            "name": c.subject.clone(),
                            "description": format!("Capsule '{}' by {}", c.subject, c.from),
                            "mimeType": "text/plain"
                        })
                    })
                    .collect();

                json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "result": {
                        "resources": resources
                    }
                })
            }
            "resources/read" => {
                self.reload();
                let uri = params.get("uri").and_then(Value::as_str).unwrap_or("");
                let identifier = uri.strip_prefix("capsule://").unwrap_or(uri);

                let found = self.vault.capsules.iter().find(|c| {
                    c.file_name == identifier
                        || c.message_id == identifier
                        || c.message_id.trim_matches(|ch| ch == '<' || ch == '>') == identifier
                });

                match found {
                    Some(c) => {
                        let text = links::page_text(c);
                        json!({
                            "jsonrpc": "2.0",
                            "id": id,
                            "result": {
                                "contents": [
                                    {
                                        "uri": uri,
                                        "mimeType": "text/plain",
                                        "text": text
                                    }
                                ]
                            }
                        })
                    }
                    None => {
                        json!({
                            "jsonrpc": "2.0",
                            "id": id,
                            "error": {
                                "code": -32602,
                                "message": format!("Resource not found: {uri}")
                            }
                        })
                    }
                }
            }
            _ => {
                json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "error": {
                        "code": -32601,
                        "message": format!("Method not found: {method}")
                    }
                })
            }
        };

        Some(response.to_string())
    }

    fn call_tool(&mut self, name: &str, args: &Value) -> Result<Value, String> {
        self.reload();
        match name {
            "capsule_list" => self.tool_capsule_list(args),
            "capsule_read" => self.tool_capsule_read(args),
            "capsule_search" => self.tool_capsule_search(args),
            "capsule_create" => self.tool_capsule_create(args),
            "capsule_reply" => self.tool_capsule_reply(args),
            unknown => Err(format!("Unknown tool: {unknown}")),
        }
    }

    fn tool_capsule_list(&self, args: &Value) -> Result<Value, String> {
        let tag_filter = args.get("tag").and_then(Value::as_str).map(str::trim);

        let list: Vec<Value> = self
            .vault
            .capsules
            .iter()
            .filter(|c| {
                if let Some(tag) = tag_filter {
                    c.tags.iter().any(|t| t.eq_ignore_ascii_case(tag))
                } else {
                    true
                }
            })
            .map(|c| {
                json!({
                    "id": c.message_id,
                    "subject": c.subject,
                    "from": c.from,
                    "to": c.to,
                    "date": c.date,
                    "tags": c.tags,
                    "status": c.status,
                    "parent_id": c.parent_id,
                    "file_name": c.file_name,
                    "native": c.native,
                    "blocks_count": c.blocks.len(),
                    "attachments_count": c.attachments.len()
                })
            })
            .collect();

        Ok(json!({
            "count": list.len(),
            "capsules": list
        }))
    }

    fn find_capsule(&self, id: &str) -> Option<(usize, &Capsule)> {
        let clean = id.trim();
        self.vault
            .capsules
            .iter()
            .enumerate()
            .find(|(_, c)| {
                c.message_id == clean
                    || c.message_id.trim_matches(|ch| ch == '<' || ch == '>') == clean
                    || c.file_name.eq_ignore_ascii_case(clean)
                    || c.subject.eq_ignore_ascii_case(clean)
            })
    }

    fn tool_capsule_read(&self, args: &Value) -> Result<Value, String> {
        let id = args
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| "Missing required argument 'id'".to_string())?;

        let (_, capsule) = self
            .find_capsule(id)
            .ok_or_else(|| format!("Capsule not found: '{id}'"))?;

        let full_text = links::page_text(capsule);
        let attachments: Vec<Value> = capsule
            .attachments
            .iter()
            .map(|a| {
                json!({
                    "name": a.name,
                    "cid": a.cid,
                    "mime_type": a.mime_type,
                    "size_bytes": a.size_bytes
                })
            })
            .collect();

        Ok(json!({
            "id": capsule.message_id,
            "subject": capsule.subject,
            "from": capsule.from,
            "to": capsule.to,
            "date": capsule.date,
            "tags": capsule.tags,
            "status": capsule.status,
            "parent_id": capsule.parent_id,
            "in_reply_to": capsule.in_reply_to,
            "references": capsule.references,
            "file_name": capsule.file_name,
            "content": full_text,
            "blocks": capsule.blocks,
            "attachments": attachments
        }))
    }

    fn tool_capsule_search(&self, args: &Value) -> Result<Value, String> {
        let query = args
            .get("query")
            .and_then(Value::as_str)
            .ok_or_else(|| "Missing required argument 'query'".to_string())?;

        let limit = args
            .get("limit")
            .and_then(Value::as_u64)
            .map(|l| l as usize)
            .unwrap_or(10);

        let mut bm25 = Bm25Index::default();
        let mut capsule_texts: HashMap<String, (String, &Capsule)> = HashMap::new();

        for c in &self.vault.capsules {
            let text = links::page_text(c);
            let tokens = search::tokenize(&text);
            bm25.add(&c.message_id, tokens);
            capsule_texts.insert(c.message_id.clone(), (text, c));
        }

        let hits = bm25.rank(query);

        let mut results: Vec<Value> = Vec::new();
        for hit in hits.into_iter().take(limit) {
            if let Some((text, capsule)) = capsule_texts.get(&hit.id) {
                let snippet = search::snippet(text, query, 160)
                    .unwrap_or_else(|| {
                        let lines: Vec<&str> = text.lines().filter(|l| !l.trim().is_empty()).collect();
                        lines.first().copied().unwrap_or("").to_string()
                    });

                results.push(json!({
                    "id": capsule.message_id,
                    "file_name": capsule.file_name,
                    "subject": capsule.subject,
                    "score": hit.score,
                    "snippet": snippet,
                    "tags": capsule.tags,
                    "date": capsule.date
                }));
            }
        }

        Ok(json!({
            "query": query,
            "total_matches": results.len(),
            "results": results
        }))
    }

    fn tool_capsule_create(&mut self, args: &Value) -> Result<Value, String> {
        let subject = args
            .get("subject")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .ok_or_else(|| "Missing required argument 'subject'".to_string())?;

        let parent_id = args
            .get("parent_id")
            .and_then(Value::as_str)
            .map(|s| s.trim().to_string());

        let author = args
            .get("author")
            .and_then(Value::as_str)
            .unwrap_or("AI Agent");

        let tags: Vec<String> = args
            .get("tags")
            .and_then(Value::as_array)
            .map(|arr| {
                arr.iter()
                    .filter_map(Value::as_str)
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .map(ToString::to_string)
                    .collect()
            })
            .unwrap_or_default();

        let index = self.vault.create_page(parent_id.clone())?;

        let mut blocks: Vec<Value> = Vec::new();

        // 1. Content paragraphs
        if let Some(content) = args.get("content").and_then(Value::as_str) {
            let paras: Vec<&str> = content
                .split("\n\n")
                .map(str::trim)
                .filter(|p| !p.is_empty())
                .collect();

            if paras.is_empty() {
                blocks.push(json!({
                    "id": new_block_id("paragraph"),
                    "type": "paragraph",
                    "data": { "text": content }
                }));
            } else {
                for p in paras {
                    blocks.push(json!({
                        "id": new_block_id("paragraph"),
                        "type": "paragraph",
                        "data": { "text": p }
                    }));
                }
            }
        }

        // 2. Callouts
        if let Some(callouts) = args.get("callouts").and_then(Value::as_array) {
            for callout in callouts {
                if let Some(text) = callout.get("text").and_then(Value::as_str) {
                    let tone = callout
                        .get("tone")
                        .and_then(Value::as_str)
                        .unwrap_or("indigo");

                    blocks.push(json!({
                        "id": new_block_id("callout"),
                        "type": "callout",
                        "data": {
                            "title": "Agent Note",
                            "content": text,
                            "tone": tone,
                            "icon": "info"
                        }
                    }));
                }
            }
        }

        // 3. Todos
        if let Some(todos) = args.get("todos").and_then(Value::as_array) {
            let items: Vec<Value> = todos
                .iter()
                .filter_map(Value::as_str)
                .enumerate()
                .map(|(i, item_text)| {
                    json!({
                        "id": format!("todo_{i}"),
                        "text": item_text,
                        "done": false
                    })
                })
                .collect();

            if !items.is_empty() {
                blocks.push(json!({
                    "id": new_block_id("todo_list"),
                    "type": "todo_list",
                    "data": {
                        "title": "Action Items",
                        "items": items
                    }
                }));
            }
        }

        if blocks.is_empty() {
            blocks.push(json!({
                "id": new_block_id("paragraph"),
                "type": "paragraph",
                "data": { "text": "" }
            }));
        }

        // Apply changes to the created capsule
        let capsule = &mut self.vault.capsules[index];
        capsule.subject = subject.to_string();
        capsule.from = format!("{author} <agent@capsuleos.local>");
        capsule.blocks = blocks;
        if !tags.is_empty() {
            capsule.tags = tags;
        }

        self.vault.save(index)?;

        let saved = &self.vault.capsules[index];
        Ok(json!({
            "success": true,
            "id": saved.message_id,
            "file_name": saved.file_name,
            "subject": saved.subject,
            "status": saved.status,
            "blocks_count": saved.blocks.len(),
            "parent_id": saved.parent_id
        }))
    }

    fn tool_capsule_reply(&mut self, args: &Value) -> Result<Value, String> {
        let parent_id = args
            .get("parent_id")
            .and_then(Value::as_str)
            .ok_or_else(|| "Missing required argument 'parent_id'".to_string())?;

        let content = args
            .get("content")
            .and_then(Value::as_str)
            .ok_or_else(|| "Missing required argument 'content'".to_string())?;

        let (_, parent) = self
            .find_capsule(parent_id)
            .ok_or_else(|| format!("Parent capsule not found: '{parent_id}'"))?;

        let parent_msg_id = parent.message_id.clone();
        let default_subject = if parent.subject.starts_with("Re: ") {
            parent.subject.clone()
        } else {
            format!("Re: {}", parent.subject)
        };

        let subject = args
            .get("subject")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .unwrap_or(&default_subject);

        let author = args
            .get("author")
            .and_then(Value::as_str)
            .unwrap_or("AI Opponent");

        let mut references = parent.references.clone();
        if !references.contains(&parent_msg_id) {
            references.push(parent_msg_id.clone());
        }

        let inherited_tags = parent.tags.clone();

        // Create the new child page
        let index = self.vault.create_page(Some(parent_msg_id.clone()))?;
        let capsule = &mut self.vault.capsules[index];

        capsule.subject = subject.to_string();
        capsule.from = format!("{author} <opponent@capsuleos.local>");
        capsule.in_reply_to = Some(parent_msg_id.clone());
        capsule.references = references;
        capsule.tags = inherited_tags;

        let mut blocks = Vec::new();
        for p in content.split("\n\n").map(str::trim).filter(|p| !p.is_empty()) {
            blocks.push(json!({
                "id": new_block_id("paragraph"),
                "type": "paragraph",
                "data": { "text": p }
            }));
        }
        if blocks.is_empty() {
            blocks.push(json!({
                "id": new_block_id("paragraph"),
                "type": "paragraph",
                "data": { "text": content }
            }));
        }
        capsule.blocks = blocks;

        self.vault.save(index)?;

        let saved = &self.vault.capsules[index];
        Ok(json!({
            "success": true,
            "id": saved.message_id,
            "file_name": saved.file_name,
            "subject": saved.subject,
            "parent_id": saved.parent_id,
            "in_reply_to": saved.in_reply_to,
            "blocks_count": saved.blocks.len()
        }))
    }
}

/// Run the stdio JSON-RPC loop.
pub fn run_server(vault_override: Option<PathBuf>) {
    let mut handler = McpHandler::new(vault_override);
    eprintln!(
        "[capsulecraft-mcp] Starting server on stdio. Active vault: {}",
        handler.vault.dir.display()
    );
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut stdout_lock = stdout.lock();

    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) => l,
            Err(err) => {
                eprintln!("[capsulecraft-mcp] Stdin error: {err}");
                break;
            }
        };

        let trimmed = line.trim().trim_start_matches('\u{feff}');
        if trimmed.is_empty() {
            continue;
        }

        if let Some(response) = handler.handle_message(trimmed) {
            let _ = stdout_lock.write_all(response.as_bytes());
            let _ = stdout_lock.write_all(b"\n");
            let _ = stdout_lock.flush();
        }
    }

    eprintln!("[capsulecraft-mcp] Stdio stream closed. Shutting down.");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_vault() -> PathBuf {
        let unique = format!(
            "capsulecraft_test_mcp_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        let path = std::env::temp_dir().join(unique);
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn initialize_and_ping_flow() {
        let dir = temp_vault();
        let mut handler = McpHandler::new(Some(dir.clone()));

        let init_req = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05"
            }
        })
        .to_string();

        let resp = handler.handle_message(&init_req).expect("response");
        let resp_val: Value = serde_json::from_str(&resp).unwrap();
        assert_eq!(resp_val["id"], 1);
        assert_eq!(resp_val["result"]["serverInfo"]["name"], SERVER_NAME);

        let ping_req = json!({
            "jsonrpc": "2.0",
            "id": 2,
            "method": "ping"
        })
        .to_string();

        let resp_ping = handler.handle_message(&ping_req).expect("ping response");
        let ping_val: Value = serde_json::from_str(&resp_ping).unwrap();
        assert_eq!(ping_val["id"], 2);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn tools_list_and_create_capsule() {
        let dir = temp_vault();
        let mut handler = McpHandler::new(Some(dir.clone()));

        // 1. List tools
        let list_req = json!({
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/list"
        })
        .to_string();
        let resp = handler.handle_message(&list_req).expect("tools list response");
        let val: Value = serde_json::from_str(&resp).unwrap();
        let tools = val["result"]["tools"].as_array().expect("tools array");
        assert!(tools.iter().any(|t| t["name"] == "capsule_create"));
        assert!(tools.iter().any(|t| t["name"] == "capsule_search"));

        // 2. Create a capsule
        let create_req = json!({
            "jsonrpc": "2.0",
            "id": 4,
            "method": "tools/call",
            "params": {
                "name": "capsule_create",
                "arguments": {
                    "subject": "AI Sharding Strategy",
                    "content": "Paragraph one.\n\nParagraph two with details.",
                    "author": "Antigravity",
                    "tags": ["architecture", "scaling"],
                    "callouts": [
                        { "text": "Important invariant: zero-data loss", "tone": "emerald" }
                    ],
                    "todos": ["Benchmarking", "Rollout plan"]
                }
            }
        })
        .to_string();

        let resp = handler.handle_message(&create_req).expect("create response");
        let val: Value = serde_json::from_str(&resp).unwrap();
        assert_eq!(val["result"]["isError"], false);

        // 3. Search for it
        let search_req = json!({
            "jsonrpc": "2.0",
            "id": 5,
            "method": "tools/call",
            "params": {
                "name": "capsule_search",
                "arguments": {
                    "query": "Sharding"
                }
            }
        })
        .to_string();

        let resp = handler.handle_message(&search_req).expect("search response");
        let val: Value = serde_json::from_str(&resp).unwrap();
        let text_content = val["result"]["content"][0]["text"].as_str().unwrap();
        let search_result: Value = serde_json::from_str(text_content).unwrap();
        assert_eq!(search_result["total_matches"], 1);
        assert_eq!(search_result["results"][0]["subject"], "AI Sharding Strategy");

        // 4. Read it
        let read_req = json!({
            "jsonrpc": "2.0",
            "id": 6,
            "method": "tools/call",
            "params": {
                "name": "capsule_read",
                "arguments": {
                    "id": "AI Sharding Strategy"
                }
            }
        })
        .to_string();

        let resp = handler.handle_message(&read_req).expect("read response");
        let val: Value = serde_json::from_str(&resp).unwrap();
        assert_eq!(val["result"]["isError"], false);

        let _ = fs::remove_dir_all(&dir);
    }
}
