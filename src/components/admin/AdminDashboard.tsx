'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  createItem,
  deleteItem,
  listMessages,
  listMilestones,
  listPhotos,
  readConfig,
  reorderItems,
  saveConfig,
  updateItem,
  type Resource,
} from '@/lib/admin';
import type { Message, Milestone, Photo, SiteConfig } from '@/lib/types';
import { Button, ImageField, SelectField, TextArea, TextField } from './fields';

type Tab = Resource | 'config';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'milestones', label: 'Hành trình' },
  { id: 'photos', label: 'Khoảnh khắc' },
  { id: 'messages', label: 'Lời nhắn' },
  { id: 'config', label: 'Cấu hình' },
];

const EMPTY_MILESTONE = {
  dateLabel: '',
  title: '',
  body: '',
  imageUrl: '',
  caption: '',
  aspect: '4/3',
  tilt: -2,
};

const EMPTY_MESSAGE = {
  title: '',
  body: '',
  signature: '',
  imageUrl: '',
  photoCaption: '',
};

const EMPTY_PHOTO = {
  imageUrl: '',
  title: '',
  subtitle: '',
  span: 'wide' as Photo['span'],
};

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('milestones');
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b, c, d] = await Promise.all([
        listMilestones(),
        listMessages(),
        listPhotos(),
        readConfig(),
      ]);
      setMilestones(a);
      setMessages(b);
      setPhotos(c);
      setConfig(d);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action();
      setStatus(done);
      setError(null);
      await refresh();
      window.setTimeout(() => setStatus(null), 2500);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Thao tác thất bại');
    }
  }

  function move(resource: Resource, ids: string[], from: number, to: number) {
    if (to < 0 || to >= ids.length) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    void run(() => reorderItems(resource, next), 'Đã đổi thứ tự');
  }

  return (
    <div className="min-h-[100dvh] bg-surface-low py-10">
      <div className="mx-auto max-w-[1000px] px-5 sm:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] font-semibold text-burgundy">
              Quản lý nội dung
            </h1>
            <p className="mt-2 text-base text-ink-soft italic">
              Sửa ở đây, tải lại trang chính là thấy.
            </p>
          </div>
          <a
            href="/"
            className="rounded-frame border border-gold px-4 py-2 text-sm tracking-[0.14em] text-gold-deep uppercase"
          >
            Xem trang
          </a>
        </header>

        <nav className="mt-8 flex flex-wrap gap-2 border-b border-hairline/60 pb-3">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-frame px-4 py-2 text-sm tracking-[0.14em] uppercase transition-colors ${
                tab === item.id
                  ? 'bg-burgundy text-gold-pale'
                  : 'text-ink-soft hover:text-gold-deep'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div aria-live="polite" className="mt-4 min-h-6 text-sm">
          {error ? <p className="text-burgundy-tint">{error}</p> : null}
          {status ? <p className="text-gold-deep">{status}</p> : null}
        </div>

        {loading ? (
          <div className="mt-6 space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-frame bg-surface-high"
              />
            ))}
          </div>
        ) : (
          <div className="mt-2 pb-16">
            {tab === 'milestones' ? (
              <MilestonePanel
                items={milestones}
                onRun={run}
                onMove={(from, to) =>
                  move('milestones', milestones.map((m) => m.id), from, to)
                }
              />
            ) : null}

            {tab === 'photos' ? (
              <PhotoPanel
                items={photos}
                onRun={run}
                onMove={(from, to) =>
                  move('photos', photos.map((p) => p.id), from, to)
                }
              />
            ) : null}

            {tab === 'messages' ? (
              <MessagePanel
                items={messages}
                onRun={run}
                onMove={(from, to) =>
                  move('messages', messages.map((m) => m.id), from, to)
                }
              />
            ) : null}

            {tab === 'config' && config ? (
              <ConfigPanel config={config} onRun={run} />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

type RunFn = (action: () => Promise<unknown>, done: string) => Promise<void>;

/**
 * Edits live in local state and only reach the API when "Lưu" is pressed, so
 * typing never fires a PATCH per keystroke.
 */
function Row({
  children,
  dirty,
  onSave,
  onUp,
  onDown,
  onDelete,
}: {
  children: React.ReactNode;
  dirty: boolean;
  onSave: () => void;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-frame border border-hairline/60 bg-surface-lowest p-5">
      {children}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-hairline/40 pt-4">
        <Button onClick={onSave} disabled={!dirty}>
          {dirty ? 'Lưu' : 'Đã lưu'}
        </Button>
        <Button variant="ghost" onClick={onUp}>
          Lên
        </Button>
        <Button variant="ghost" onClick={onDown}>
          Xuống
        </Button>
        <span className="grow" />
        <Button variant="danger" onClick={onDelete}>
          Xóa
        </Button>
      </div>
    </div>
  );
}

/** Keeps a local copy of a record and reports whether it diverged. */
function useDraft<T extends object>(source: T) {
  const [draft, setDraft] = useState(source);
  const key = JSON.stringify(source);
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setDraft(source);
  }
  return {
    draft,
    set: (patch: Partial<T>) => setDraft((prev) => ({ ...prev, ...patch })),
    dirty: JSON.stringify(draft) !== key,
  };
}

function MilestonePanel({
  items,
  onRun,
  onMove,
}: {
  items: Milestone[];
  onRun: RunFn;
  onMove: (from: number, to: number) => void;
}) {
  const [draft, setDraft] = useState({ ...EMPTY_MILESTONE });

  return (
    <div className="space-y-5">
      <form
        className="space-y-4 rounded-frame border border-gold/60 bg-surface-lowest p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void onRun(
            () => createItem('milestones', { ...draft, order: items.length }),
            'Đã thêm mốc',
          ).then(() => setDraft({ ...EMPTY_MILESTONE }));
        }}
      >
        <h2 className="text-xl text-burgundy">Thêm mốc mới</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Nhãn thời gian"
            value={draft.dateLabel}
            onChange={(dateLabel) => setDraft({ ...draft, dateLabel })}
            placeholder="Tháng 10, 2021"
          />
          <TextField
            label="Tiêu đề"
            value={draft.title}
            onChange={(title) => setDraft({ ...draft, title })}
          />
        </div>
        <TextArea
          label="Nội dung"
          value={draft.body}
          onChange={(body) => setDraft({ ...draft, body })}
        />
        <ImageField
          label="Ảnh"
          value={draft.imageUrl}
          onChange={(imageUrl) => setDraft({ ...draft, imageUrl })}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Chú thích ảnh"
            value={draft.caption}
            onChange={(caption) => setDraft({ ...draft, caption })}
          />
          <SelectField
            label="Tỉ lệ khung"
            value={draft.aspect}
            onChange={(aspect) => setDraft({ ...draft, aspect })}
            options={[
              { value: '4/3', label: '4:3 ngang' },
              { value: '1/1', label: '1:1 vuông' },
              { value: '4/5', label: '4:5 dọc' },
            ]}
          />
          <TextField
            label="Độ nghiêng (độ)"
            value={String(draft.tilt)}
            onChange={(tilt) => setDraft({ ...draft, tilt: Number(tilt) || 0 })}
          />
        </div>
        <Button type="submit" disabled={!draft.title || !draft.imageUrl}>
          Thêm mốc
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState text="Chưa có mốc nào. Thêm mốc đầu tiên ở trên." />
      ) : (
        items.map((item, index) => (
          <MilestoneCard
            key={item.id}
            item={item}
            onRun={onRun}
            onUp={() => onMove(index, index - 1)}
            onDown={() => onMove(index, index + 1)}
          />
        ))
      )}
    </div>
  );
}

function MilestoneCard({
  item,
  onRun,
  onUp,
  onDown,
}: {
  item: Milestone;
  onRun: RunFn;
  onUp: () => void;
  onDown: () => void;
}) {
  const { draft, set, dirty } = useDraft({
    dateLabel: item.dateLabel,
    title: item.title,
    body: item.body,
    imageUrl: item.imageUrl,
    caption: item.caption ?? '',
    aspect: item.aspect,
    tilt: item.tilt,
  });

  return (
    <Row
      dirty={dirty}
      onSave={() =>
        void onRun(() => updateItem('milestones', item.id, draft), 'Đã lưu mốc')
      }
      onUp={onUp}
      onDown={onDown}
      onDelete={() =>
        void onRun(() => deleteItem('milestones', item.id), 'Đã xóa mốc')
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Nhãn thời gian"
          value={draft.dateLabel}
          onChange={(dateLabel) => set({ dateLabel })}
        />
        <TextField
          label="Tiêu đề"
          value={draft.title}
          onChange={(title) => set({ title })}
        />
      </div>
      <div className="mt-4">
        <TextArea
          label="Nội dung"
          value={draft.body}
          onChange={(body) => set({ body })}
        />
      </div>
      <div className="mt-4">
        <ImageField
          label="Ảnh"
          value={draft.imageUrl}
          onChange={(imageUrl) => set({ imageUrl })}
        />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <TextField
          label="Chú thích ảnh"
          value={draft.caption}
          onChange={(caption) => set({ caption })}
        />
        <SelectField
          label="Tỉ lệ khung"
          value={draft.aspect}
          onChange={(aspect) => set({ aspect })}
          options={[
            { value: '4/3', label: '4:3 ngang' },
            { value: '1/1', label: '1:1 vuông' },
            { value: '4/5', label: '4:5 dọc' },
          ]}
        />
        <TextField
          label="Độ nghiêng (độ)"
          value={String(draft.tilt)}
          onChange={(tilt) => set({ tilt: Number(tilt) || 0 })}
        />
      </div>
    </Row>
  );
}

function PhotoPanel({
  items,
  onRun,
  onMove,
}: {
  items: Photo[];
  onRun: RunFn;
  onMove: (from: number, to: number) => void;
}) {
  const [draft, setDraft] = useState({ ...EMPTY_PHOTO });

  return (
    <div className="space-y-5">
      <form
        className="space-y-4 rounded-frame border border-gold/60 bg-surface-lowest p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void onRun(
            () => createItem('photos', { ...draft, order: items.length }),
            'Đã thêm ảnh',
          ).then(() => setDraft({ ...EMPTY_PHOTO }));
        }}
      >
        <h2 className="text-xl text-burgundy">Thêm ảnh</h2>
        <ImageField
          label="Ảnh"
          value={draft.imageUrl}
          onChange={(imageUrl) => setDraft({ ...draft, imageUrl })}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Tiêu đề"
            value={draft.title}
            onChange={(title) => setDraft({ ...draft, title })}
          />
          <TextField
            label="Chú thích"
            value={draft.subtitle}
            onChange={(subtitle) => setDraft({ ...draft, subtitle })}
          />
          <SelectField
            label="Khổ ảnh"
            value={draft.span}
            onChange={(span) =>
              setDraft({ ...draft, span: span as Photo['span'] })
            }
            options={[
              { value: 'wide', label: 'Ngang rộng' },
              { value: 'square', label: 'Vuông' },
              { value: 'tall', label: 'Dọc' },
            ]}
          />
        </div>
        <Button type="submit" disabled={!draft.imageUrl}>
          Thêm ảnh
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState text="Album trống. Tải ảnh đầu tiên lên ở trên." />
      ) : (
        items.map((item, index) => (
          <PhotoCard
            key={item.id}
            item={item}
            onRun={onRun}
            onUp={() => onMove(index, index - 1)}
            onDown={() => onMove(index, index + 1)}
          />
        ))
      )}
    </div>
  );
}

function PhotoCard({
  item,
  onRun,
  onUp,
  onDown,
}: {
  item: Photo;
  onRun: RunFn;
  onUp: () => void;
  onDown: () => void;
}) {
  const { draft, set, dirty } = useDraft({
    imageUrl: item.imageUrl,
    title: item.title ?? '',
    subtitle: item.subtitle ?? '',
    span: item.span,
  });

  return (
    <Row
      dirty={dirty}
      onSave={() =>
        void onRun(() => updateItem('photos', item.id, draft), 'Đã lưu ảnh')
      }
      onUp={onUp}
      onDown={onDown}
      onDelete={() =>
        void onRun(() => deleteItem('photos', item.id), 'Đã xóa ảnh')
      }
    >
      <ImageField
        label="Ảnh"
        value={draft.imageUrl}
        onChange={(imageUrl) => set({ imageUrl })}
      />
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <TextField
          label="Tiêu đề"
          value={draft.title}
          onChange={(title) => set({ title })}
        />
        <TextField
          label="Chú thích"
          value={draft.subtitle}
          onChange={(subtitle) => set({ subtitle })}
        />
        <SelectField
          label="Khổ ảnh"
          value={draft.span}
          onChange={(span) => set({ span: span as Photo['span'] })}
          options={[
            { value: 'wide', label: 'Ngang rộng' },
            { value: 'square', label: 'Vuông' },
            { value: 'tall', label: 'Dọc' },
          ]}
        />
      </div>
    </Row>
  );
}

function MessagePanel({
  items,
  onRun,
  onMove,
}: {
  items: Message[];
  onRun: RunFn;
  onMove: (from: number, to: number) => void;
}) {
  const [draft, setDraft] = useState({ ...EMPTY_MESSAGE });

  return (
    <div className="space-y-5">
      <form
        className="space-y-4 rounded-frame border border-gold/60 bg-surface-lowest p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void onRun(
            () => createItem('messages', { ...draft, order: items.length }),
            'Đã thêm lời nhắn',
          ).then(() => setDraft({ ...EMPTY_MESSAGE }));
        }}
      >
        <h2 className="text-xl text-burgundy">Thêm lời nhắn</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Tiêu đề"
            value={draft.title}
            onChange={(title) => setDraft({ ...draft, title })}
          />
          <TextField
            label="Chữ ký"
            value={draft.signature}
            onChange={(signature) => setDraft({ ...draft, signature })}
            placeholder="Gửi từ mùa thu"
          />
        </div>
        <TextArea
          label="Nội dung"
          value={draft.body}
          onChange={(body) => setDraft({ ...draft, body })}
        />
        <ImageField
          label="Ảnh polaroid"
          value={draft.imageUrl}
          onChange={(imageUrl) => setDraft({ ...draft, imageUrl })}
        />
        <TextField
          label="Chú thích dưới ảnh"
          value={draft.photoCaption}
          onChange={(photoCaption) => setDraft({ ...draft, photoCaption })}
        />
        <Button type="submit" disabled={!draft.title || !draft.imageUrl}>
          Thêm lời nhắn
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState text="Chưa có lời nhắn nào." />
      ) : (
        items.map((item, index) => (
          <MessageCard
            key={item.id}
            item={item}
            onRun={onRun}
            onUp={() => onMove(index, index - 1)}
            onDown={() => onMove(index, index + 1)}
          />
        ))
      )}
    </div>
  );
}

function MessageCard({
  item,
  onRun,
  onUp,
  onDown,
}: {
  item: Message;
  onRun: RunFn;
  onUp: () => void;
  onDown: () => void;
}) {
  const { draft, set, dirty } = useDraft({
    title: item.title,
    body: item.body,
    signature: item.signature ?? '',
    imageUrl: item.imageUrl,
    photoCaption: item.photoCaption ?? '',
  });

  return (
    <Row
      dirty={dirty}
      onSave={() =>
        void onRun(
          () => updateItem('messages', item.id, draft),
          'Đã lưu lời nhắn',
        )
      }
      onUp={onUp}
      onDown={onDown}
      onDelete={() =>
        void onRun(() => deleteItem('messages', item.id), 'Đã xóa lời nhắn')
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Tiêu đề"
          value={draft.title}
          onChange={(title) => set({ title })}
        />
        <TextField
          label="Chữ ký"
          value={draft.signature}
          onChange={(signature) => set({ signature })}
        />
      </div>
      <div className="mt-4">
        <TextArea
          label="Nội dung"
          value={draft.body}
          onChange={(body) => set({ body })}
        />
      </div>
      <div className="mt-4">
        <ImageField
          label="Ảnh polaroid"
          value={draft.imageUrl}
          onChange={(imageUrl) => set({ imageUrl })}
        />
      </div>
      <div className="mt-4">
        <TextField
          label="Chú thích dưới ảnh"
          value={draft.photoCaption}
          onChange={(photoCaption) => set({ photoCaption })}
        />
      </div>
    </Row>
  );
}

function ConfigPanel({
  config,
  onRun,
}: {
  config: SiteConfig;
  onRun: RunFn;
}) {
  const [draft, setDraft] = useState({ ...config, gatePin: '' });

  return (
    <form
      className="space-y-4 rounded-frame border border-hairline/60 bg-surface-lowest p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const { id: _id, gatePin, ...rest } = draft;
        void onRun(
          () => saveConfig(gatePin ? { ...rest, gatePin } : rest),
          'Đã lưu cấu hình',
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Tên trang"
          value={draft.siteTitle}
          onChange={(siteTitle) => setDraft({ ...draft, siteTitle })}
        />
        <TextField
          label="Dòng cuối trang"
          value={draft.footerText}
          onChange={(footerText) => setDraft({ ...draft, footerText })}
        />
        <TextField
          label="Câu hỏi mở màn"
          value={draft.gateQuestion}
          onChange={(gateQuestion) => setDraft({ ...draft, gateQuestion })}
        />
        <TextField
          label="Gợi ý dưới câu hỏi"
          value={draft.gateHint}
          onChange={(gateHint) => setDraft({ ...draft, gateHint })}
        />
        <TextField
          label="Mã mở màn mới"
          value={draft.gatePin}
          onChange={(gatePin) => setDraft({ ...draft, gatePin })}
          hint="6 chữ số. Để trống nếu giữ mã cũ."
        />
        <TextField
          label="Tiêu đề phần hành trình"
          value={draft.journeyTitle}
          onChange={(journeyTitle) => setDraft({ ...draft, journeyTitle })}
        />
      </div>

      <TextArea
        label="Mô tả phần hành trình"
        rows={3}
        value={draft.journeyIntro}
        onChange={(journeyIntro) => setDraft({ ...draft, journeyIntro })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Tiêu đề phần lời nhắn"
          value={draft.messagesTitle}
          onChange={(messagesTitle) => setDraft({ ...draft, messagesTitle })}
        />
        <TextField
          label="Chú thích ảnh cuối"
          value={draft.confessCaption}
          onChange={(confessCaption) => setDraft({ ...draft, confessCaption })}
        />
      </div>

      <TextArea
        label="Mô tả phần lời nhắn"
        rows={3}
        value={draft.messagesIntro}
        onChange={(messagesIntro) => setDraft({ ...draft, messagesIntro })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Dòng dẫn phần kết"
          value={draft.confessEyebrow}
          onChange={(confessEyebrow) => setDraft({ ...draft, confessEyebrow })}
        />
        <TextField
          label="Câu tỏ tình"
          value={draft.confessHeadline}
          onChange={(confessHeadline) => setDraft({ ...draft, confessHeadline })}
        />
        <TextField
          label="Nút đồng ý"
          value={draft.confessPrimaryCta}
          onChange={(confessPrimaryCta) =>
            setDraft({ ...draft, confessPrimaryCta })
          }
        />
        <TextField
          label="Nút còn lại"
          value={draft.confessDenyCta}
          onChange={(confessDenyCta) => setDraft({ ...draft, confessDenyCta })}
        />
      </div>

      <ImageField
        label="Ảnh phần kết"
        value={draft.confessImageUrl}
        onChange={(confessImageUrl) => setDraft({ ...draft, confessImageUrl })}
      />

      <Button type="submit">Lưu cấu hình</Button>
    </form>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-frame border border-dashed border-hairline p-10 text-center">
      <p className="text-lg text-ink-soft italic">{text}</p>
    </div>
  );
}
