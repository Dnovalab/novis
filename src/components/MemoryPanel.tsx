/**
 * MemoryPanel — AI 记忆管理面板
 *
 * 管理持久化的项目记忆（事实、决策、偏好、笔记），
 * 自动注入到 AI 对话上下文。
 */

import { useState, useEffect } from "react";
import {
  Brain,
  Plus,
  Trash2,
  Lightbulb,
  GitBranch,
  Code,
  StickyNote,
  Filter,
  Search,
  X,
  Check,
  AlertTriangle,
  Info,
} from "lucide-react";
import {
  useMemoryStore,
  type MemoryType,
  typeLabels,
  typeColors,
} from "@/stores/memory-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const memoryTypes: MemoryType[] = ["fact", "decision", "preference", "note"];

/** 类型图标 */
const typeIcons: Record<MemoryType, typeof Lightbulb> = {
  fact: Info,
  decision: GitBranch,
  preference: Code,
  note: StickyNote,
};

// ====== 子组件：添加/编辑表单 ======

function MemoryForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: { type: MemoryType; content: string; tags: string };
  onSave: (type: MemoryType, content: string, tags: string[]) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<MemoryType>(initial?.type ?? "note");
  const [content, setContent] = useState(initial?.content ?? "");
  const [tagsInput, setTagsInput] = useState(initial?.tags ?? "");

  const handleSubmit = () => {
    if (!content.trim()) return;
    const tags = tagsInput
      .split(/[,，、\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    onSave(type, content.trim(), tags);
  };

  return (
    <div className="space-y-2 border-b p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground">
          {initial ? "编辑记忆" : "新建记忆"}
        </span>
        <button
          onClick={onCancel}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* 类型选择 */}
      <div className="flex gap-1">
        {memoryTypes.map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={cn(
              "flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] transition-colors",
              type === t
                ? typeColors[t]
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            {typeLabels[t]}
          </button>
        ))}
      </div>

      {/* 内容 */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="记录项目事实、决策或偏好…"
        className="min-h-[50px] w-full resize-none rounded border bg-background p-2 text-xs outline-none focus:border-primary"
        rows={3}
      />

      {/* 标签 */}
      <input
        value={tagsInput}
        onChange={(e) => setTagsInput(e.target.value)}
        placeholder="标签（逗号分隔）"
        className="w-full rounded border bg-background px-2 py-1 text-[10px] outline-none focus:border-primary"
      />

      <div className="flex justify-end gap-1">
        <Button
          size="sm"
          className="h-7 text-[11px]"
          onClick={handleSubmit}
          disabled={!content.trim()}
        >
          <Check className="mr-1 h-3 w-3" />
          {initial ? "保存" : "创建"}
        </Button>
      </div>
    </div>
  );
}

// ====== 子组件：记忆条目卡片 ======

function MemoryCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: import("@/stores/memory-store").MemoryEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = typeIcons[entry.type];

  return (
    <div className="rounded-md border bg-card p-2 transition-colors hover:border-primary/30">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Icon className={cn("h-3 w-3", typeColors[entry.type].split(" ")[0])} />
          <span className={cn("rounded px-1 py-0.5 text-[9px]", typeColors[entry.type])}>
            {typeLabels[entry.type]}
          </span>
        </div>
        <div className="flex gap-0.5">
          <button
            onClick={onEdit}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent"
            title="编辑"
          >
            <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="rounded p-0.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
            title="删除"
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>

      <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">
        {entry.content}
      </p>

      {entry.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-0.5">
          {entry.tags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-muted px-1 py-0.5 text-[8px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <p className="mt-1 text-[8px] text-muted-foreground/40">
        {new Date(entry.createdAt).toLocaleDateString("zh-CN", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>
  );
}

// ====== 主组件 ======

export function MemoryPanel() {
  const loadFromDisk = useMemoryStore((s) => s.loadFromDisk);
  const entries = useMemoryStore((s) => s.entries);
  const filterType = useMemoryStore((s) => s.filterType);
  const searchQuery = useMemoryStore((s) => s.searchQuery);
  const addEntry = useMemoryStore((s) => s.addEntry);
  const updateEntry = useMemoryStore((s) => s.updateEntry);
  const removeEntry = useMemoryStore((s) => s.removeEntry);
  const setFilterType = useMemoryStore((s) => s.setFilterType);
  const setSearchQuery = useMemoryStore((s) => s.setSearchQuery);
  const getFiltered = useMemoryStore((s) => s.getFiltered);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 启动时加载
  useEffect(() => {
    loadFromDisk();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredEntries = getFiltered();

  const handleSave = (type: MemoryType, content: string, tags: string[]) => {
    if (editingId) {
      updateEntry(editingId, { type, content, tags });
      setEditingId(null);
    } else {
      addEntry(type, content, tags);
    }
    setShowForm(false);
  };

  const entryCounts = memoryTypes.reduce(
    (acc, t) => {
      acc[t] = entries.filter((e) => e.type === t).length;
      acc.total += acc[t];
      return acc;
    },
    { total: 0 } as Record<string, number>,
  );

  return (
    <div className="flex h-full flex-col">
      {/* 面板头部 */}
      <div className="border-b px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium">AI 记忆</span>
            <span className="rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground">
              {entryCounts.total}
            </span>
          </div>
          {!showForm && (
            <button
              onClick={() => {
                setEditingId(null);
                setShowForm(true);
              }}
              className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
            >
              <Plus className="h-3 w-3" />
              新建
            </button>
          )}
        </div>

        {/* 类型筛选 */}
        <div className="mt-1.5 flex gap-0.5">
          <button
            onClick={() => setFilterType("all")}
            className={cn(
              "rounded px-1.5 py-0.5 text-[9px] transition-colors",
              filterType === "all"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            全部
          </button>
          {memoryTypes.map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={cn(
                "rounded px-1.5 py-0.5 text-[9px] transition-colors",
                filterType === t
                  ? typeColors[t]
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {typeLabels[t]}
              <span className="ml-0.5 opacity-60">({entryCounts[t]})</span>
            </button>
          ))}
        </div>

        {/* 搜索 */}
        <div className="relative mt-1.5">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索记忆…"
            className="w-full rounded-md border bg-background py-1 pl-6 pr-2 text-[10px] outline-none focus:border-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* 添加/编辑表单 */}
      {showForm && (
        <MemoryForm
          initial={
            editingId
              ? (() => {
                  const e = entries.find((e) => e.id === editingId);
                  return e
                    ? {
                        type: e.type,
                        content: e.content,
                        tags: e.tags.join(", "),
                      }
                    : undefined;
                })()
              : undefined
          }
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditingId(null);
          }}
        />
      )}

      {/* 记忆列表 */}
      <div className="flex-1 overflow-y-auto p-2">
        {entries.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-4 text-center">
            <Brain className="mb-2 h-6 w-6 text-muted-foreground/30" />
            <p className="text-[11px] text-muted-foreground/60">
              还没有记忆条目
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground/40">
              记录项目事实和决策，AI 会自动参考
            </p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-[10px] text-muted-foreground/60">
              未找到匹配的记忆
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredEntries.map((entry) => (
              <MemoryCard
                key={entry.id}
                entry={entry}
                onEdit={() => {
                  setEditingId(entry.id);
                  setShowForm(true);
                }}
                onDelete={() => {
                  if (confirm("确定删除这条记忆？")) {
                    removeEntry(entry.id);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
