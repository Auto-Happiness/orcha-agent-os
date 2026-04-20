"use client";

import React, { useMemo } from "react";
import CodeMirror, { Extension, ViewUpdate } from "@uiw/react-codemirror";
import { sql, MySQL, PostgreSQL, MSSQL } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { autocompletion, CompletionContext } from "@codemirror/autocomplete";

interface SqlEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  language?: "mysql" | "postgres" | "mssql" | string;
  semanticModels?: any[];
  minHeight?: string | number;
  onSelectionChange?: (text: string) => void;
}

export function SqlEditor({ 
  value, 
  onChange, 
  language = "mysql", 
  semanticModels = [],
  minHeight = 300,
  onSelectionChange
}: SqlEditorProps) {

  // 1. Determine Dialect
  const getDialect = () => {
    const lang = String(language || "mysql").toLowerCase();
    if (lang.includes("postgre")) return PostgreSQL;
    if (lang === "mssql") return MSSQL;
    return MySQL;
  };

  // 2. Custom Autocomplete Implementation
  const myCompletions = (context: CompletionContext) => {
    const word = context.matchBefore(/\w*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;

    const suggestions: any[] = [];
    const safeModels = Array.isArray(semanticModels) ? semanticModels : [];

    safeModels.forEach((model: any) => {
      if (model?.tableName) {
        suggestions.push({
          label: model.tableName,
          type: "type",
          detail: "Table",
        });

        model.fields?.forEach((f: any) => {
          if (f?.columnName) {
            suggestions.push({
              label: f.columnName,
              type: "property",
              detail: `${f.type} • ${model.tableName}`,
            });
          }
        });
      }
    });

    const keywords = ["SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "JOIN", "LIMIT", "AND", "OR", "COUNT", "SUM", "INSERT", "UPDATE", "DELETE"];
    keywords.forEach(kw => {
      suggestions.push({
        label: kw,
        type: "keyword",
      });
    });

    return {
      from: word.from,
      options: suggestions,
    };
  };

  // 3. Extensions Configuration
  const extensions = useMemo(() => {
    const exts: Extension[] = [
      sql({ dialect: getDialect() }),
      oneDark,
      autocompletion({ override: [myCompletions] }),
    ];
    return exts;
  }, [language, semanticModels]);

  return (
    <div style={{ 
      minHeight, 
      width: "100%", 
      borderRadius: "12px", 
      overflow: "hidden", 
      border: "1px solid rgba(147,51,234,0.15)", 
      background: "#13102a",
      boxShadow: "0 4px 20px rgba(0,0,0,0.2)"
    }}>
      <CodeMirror
        value={value}
        height={typeof minHeight === 'number' ? `${minHeight}px` : String(minHeight)}
        theme={oneDark}
        extensions={extensions}
        onChange={(val) => onChange(val)}
        onUpdate={(update: ViewUpdate) => {
          if (onSelectionChange && (update.selectionSet || update.docChanged)) {
            const selection = update.state.sliceDoc(
              update.state.selection.main.from,
              update.state.selection.main.to
            );
            onSelectionChange(selection);
          }
        }}
        style={{ fontSize: '13px' }}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          autocompletion: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
        }}
      />
    </div>
  );
}
