import { useEffect, useMemo, useRef, useState } from 'react';

type Article = {
  id: string;
  title: string;
  html: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type Theme = 'system' | 'light' | 'dark';

const STORE_KEY = 'kaku-v1-articles';
const SETTINGS_KEY = 'kaku-v1-settings';

const initialArticles: Article[] = [
  {
    id: 'welcome',
    title: '書くことを続けるために',
    html: '<p>書き始める前に、うまく書こうとしてしまう。けれど、最初の一文は、ただ今日考えたことを書けばいい。</p><h2>書く場所を整える</h2><p>画面から余計なものが消えると、言葉を選ぶことに集中できる。途中で止まっても、次に開いたとき、同じ場所から始められれば十分だ。</p>',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  },
  {
    id: 'walk',
    title: '朝の散歩で考えたこと',
    html: '<p>朝の空気は、考えを少しだけ軽くしてくれる。</p>',
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 86_400_000).toISOString(),
    deletedAt: null,
  },
];

function loadArticles(): Article[] {
  try {
    const stored = localStorage.getItem(STORE_KEY);
    return stored ? JSON.parse(stored) : initialArticles;
  } catch {
    return initialArticles;
  }
}

function articleText(article: Article) {
  return new DOMParser().parseFromString(article.html, 'text/html').body.textContent?.trim() ?? '';
}

function toMarkdown(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const convert = (node: ChildNode): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    const element = node as HTMLElement;
    const text = Array.from(node.childNodes).map(convert).join('');
    switch (element.tagName) {
      case 'H2': return `\n\n## ${text}\n\n`;
      case 'H3': return `\n\n### ${text}\n\n`;
      case 'P': return `${text}\n\n`;
      case 'STRONG': return `**${text}**`;
      case 'EM': return `*${text}*`;
      case 'BLOCKQUOTE': return text.split('\n').filter(Boolean).map(line => `> ${line}`).join('\n') + '\n\n';
      case 'UL': return Array.from(element.children).map(item => `- ${item.textContent}`).join('\n') + '\n\n';
      case 'OL': return Array.from(element.children).map((item, index) => `${index + 1}. ${item.textContent}`).join('\n') + '\n\n';
      case 'HR': return '\n---\n\n';
      case 'A': return `[${text}](${element.getAttribute('href') ?? ''})`;
      default: return text;
    }
  };
  return Array.from(doc.body.childNodes).map(convert).join('').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function download(filename: string, content: string, type: string) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function formatDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'いま';
  return new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric' }).format(date);
}

export default function App() {
  const [articles, setArticles] = useState<Article[]>(loadArticles);
  const [activeId, setActiveId] = useState('welcome');
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [focusMode, setFocusMode] = useState(false);
  const [readingMode, setReadingMode] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    try { return (JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}').theme as Theme) ?? 'system'; } catch { return 'system'; }
  });
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [lineHeight, setLineHeight] = useState<'normal' | 'relaxed'>('relaxed');
  const [contentWidth, setContentWidth] = useState<'normal' | 'wide'>('normal');
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<number | undefined>(undefined);

  const active = articles.find(article => article.id === activeId) ?? articles.find(article => !article.deletedAt) ?? initialArticles[0];
  const visibleArticles = articles.filter(article => showTrash ? article.deletedAt : !article.deletedAt).sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  const text = articleText(active);
  const charCount = (active.title + text).replace(/\s/g, '').length;
  const readingMinutes = Math.max(1, Math.ceil(charCount / 400));
  const headings = useMemo(() => {
    const doc = new DOMParser().parseFromString(active.html, 'text/html');
    return Array.from(doc.querySelectorAll('h2, h3')).map((node, index) => ({ id: `heading-${index}`, level: node.tagName, text: node.textContent ?? '' }));
  }, [active.html]);

  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(articles));
  }, [articles]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme, fontSize, lineHeight, contentWidth }));
    document.documentElement.dataset.theme = theme;
  }, [theme, fontSize, lineHeight, contentWidth]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        commitNow();
      }
      if (event.key === 'Escape' && readingMode) setReadingMode(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  function updateActive(update: Partial<Article>) {
    setSaveState('saving');
    setArticles(current => current.map(article => article.id === active.id ? { ...article, ...update, updatedAt: new Date().toISOString() } : article));
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => setSaveState('saved'), 600);
  }

  function commitNow() {
    window.clearTimeout(saveTimer.current);
    setSaveState('saved');
  }

  function createArticle() {
    const article: Article = { id: crypto.randomUUID(), title: '', html: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: null };
    setArticles(current => [article, ...current]);
    setActiveId(article.id);
    setShowTrash(false);
    window.setTimeout(() => document.querySelector<HTMLInputElement>('.title-input')?.focus(), 0);
  }

  function moveToTrash() {
    setArticles(current => current.map(article => article.id === active.id ? { ...article, deletedAt: new Date().toISOString() } : article));
    const next = articles.find(article => article.id !== active.id && !article.deletedAt);
    if (next) setActiveId(next.id);
    setShowTrash(true);
  }

  function restoreArticle() {
    setArticles(current => current.map(article => article.id === active.id ? { ...article, deletedAt: null, updatedAt: new Date().toISOString() } : article));
    setShowTrash(false);
  }

  function deletePermanently() {
    if (!window.confirm('この記事を完全に削除しますか？ この操作は元に戻せません。')) return;
    setArticles(current => current.filter(article => article.id !== active.id));
    const next = articles.find(article => article.id !== active.id && article.deletedAt) ?? articles.find(article => article.id !== active.id && !article.deletedAt);
    if (next) setActiveId(next.id);
  }

  function runFormat(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    updateActive({ html: editorRef.current?.innerHTML ?? active.html });
  }

  if (readingMode) {
    return <main className={`reader ${fontSize} ${lineHeight} ${contentWidth}`}><button className="quiet-button reader-close" onClick={() => setReadingMode(false)}>← 編集に戻る</button><article><h1>{active.title || '無題の記事'}</h1><div dangerouslySetInnerHTML={{ __html: active.html }} /></article></main>;
  }

  return (
    <main className={`app ${focusMode ? 'is-focused' : ''} ${fontSize} ${lineHeight} ${contentWidth}`}>
      <aside className="sidebar">
        <div className="brand">余白</div>
        <button className="new-button" onClick={createArticle}>＋ 新しい記事</button>
        <nav>
          <div className="section-label">{showTrash ? 'ゴミ箱' : '下書き'}</div>
          {visibleArticles.map(article => <button className={`article-link ${article.id === active.id ? 'active' : ''}`} onClick={() => setActiveId(article.id)} key={article.id}><strong>{article.title || '無題の記事'}</strong><span>{articleText(article).length.toLocaleString()}文字・{formatDate(article.updatedAt)}</span></button>)}
          {!visibleArticles.length && <p className="empty">記事はありません</p>}
        </nav>
        <button className="sidebar-footer" onClick={() => setShowTrash(current => !current)}>{showTrash ? '← 下書きへ戻る' : 'ゴミ箱'}</button>
      </aside>

      <section className="editor-shell">
        <header className="toolbar">
          <div className="format-buttons" aria-label="書式">
            <button onClick={() => runFormat('formatBlock', 'h2')}>見出し</button>
            <button onClick={() => runFormat('bold')}>太字</button>
            <button onClick={() => runFormat('insertUnorderedList')}>箇条書き</button>
            <button onClick={() => runFormat('formatBlock', 'blockquote')}>引用</button>
            <button onClick={() => runFormat('insertHorizontalRule')}>—</button>
          </div>
          <span className={`save-state ${saveState}`}>{saveState === 'saving' ? '保存中…' : '保存済み'}</span>
          <button className="quiet-button" onClick={() => setFocusMode(current => !current)}>{focusMode ? '通常表示' : '集中'}</button>
          <button className="quiet-button" onClick={() => setShowSettings(current => !current)} aria-expanded={showSettings}>•••</button>
          {showSettings && <div className="settings-popover">
            <label>表示テーマ<select value={theme} onChange={event => setTheme(event.target.value as Theme)}><option value="system">システム</option><option value="light">ライト</option><option value="dark">ダーク</option></select></label>
            <label>文字サイズ<select value={fontSize} onChange={event => setFontSize(event.target.value as typeof fontSize)}><option value="small">小</option><option value="medium">標準</option><option value="large">大</option></select></label>
            <label>行間<select value={lineHeight} onChange={event => setLineHeight(event.target.value as typeof lineHeight)}><option value="normal">標準</option><option value="relaxed">広い</option></select></label>
            <button onClick={() => setReadingMode(true)}>読み返しモード</button>
            <button onClick={() => download(`${active.title || 'untitled'}.md`, `# ${active.title || '無題の記事'}\n\n${toMarkdown(active.html)}`, 'text/markdown')}>Markdownを書き出す</button>
            <button onClick={() => navigator.clipboard.writeText(`# ${active.title || '無題の記事'}\n\n${toMarkdown(active.html)}`)}>Markdownをコピー</button>
            {!active.deletedAt ? <button className="danger" onClick={moveToTrash}>ゴミ箱へ移動</button> : <><button onClick={restoreArticle}>下書きへ復元</button><button className="danger" onClick={deletePermanently}>完全に削除</button></>}
          </div>}
        </header>
        <input className="title-input" placeholder="無題の記事" value={active.title} onChange={event => updateActive({ title: event.target.value })} />
        <div ref={editorRef} className="editor" contentEditable suppressContentEditableWarning data-placeholder="ここから書く" onInput={event => updateActive({ html: event.currentTarget.innerHTML })} dangerouslySetInnerHTML={{ __html: active.html }} />
        <footer className="meta">{charCount.toLocaleString()}文字　・　約{readingMinutes}分で読めます</footer>
      </section>

      <aside className="outline">
        <h2>この記事</h2>
        <button className="outline-title" onClick={() => document.querySelector<HTMLInputElement>('.title-input')?.focus()}>{active.title || '無題の記事'}</button>
        {headings.length ? headings.map((heading, index) => <button className={`outline-item ${heading.level === 'H3' ? 'nested' : ''}`} onClick={() => editorRef.current?.querySelectorAll('h2, h3')[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' })} key={`${heading.text}-${index}`}>{heading.text}</button>) : <p className="outline-empty">見出しを追加すると、ここに記事の構成が表示されます。</p>}
        <div className="checklist"><h3>投稿前チェック</h3><p>{active.title ? '✓' : '○'} タイトル</p><p>{text.length >= 300 ? '✓' : '○'} 300文字以上</p><p>{headings.length ? '✓' : '○'} 見出し</p></div>
      </aside>
    </main>
  );
}
