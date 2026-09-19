import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Archive, ArrowLeft, CalendarDays, Check, ChevronRight, CircleAlert, ClipboardList, CloudOff, Download, FileJson, HardDrive, LayoutDashboard, Pencil, Plus, Printer, Search, Settings, Shirt, Trash2, Upload, X } from 'lucide-react';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { deleteEntry, deleteItem, exportData, getEntries, getItem, getItems, makeId, now, putEntry, putItem, replaceAll, type BackupData, type Item, type StockEntry } from '@/lib/db';

const queryClient = new QueryClient();
const categories = ['Uniform Set', 'Shirts', 'Bottoms', 'Sportswear', 'Accessories', 'Other'];

function formatDate(value: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
}
function shortDate(value: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(new Date(`${value}T00:00:00`));
}
function totalForEntry(entry: StockEntry) { return Object.values(entry.quantities).reduce((sum, quantity) => sum + (Number(quantity) || 0), 0); }
function totalForItem(item: Item, entries: StockEntry[]) { return item.sizes.reduce((sum, size) => sum + entries.reduce((entrySum, entry) => entrySum + (Number(entry.quantities[size]) || 0), 0), 0); }

function Logo() {
  return <div className="flex items-center gap-3" data-testid="brand-bachpan">
    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#ef3e32] text-[#fff7df] shadow-[3px_3px_0_#f3bd2c]">
      <Shirt size={22} strokeWidth={2.6} />
      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#f3bd2c]" />
    </div>
    <div className="leading-none">
      <div className="brand-display text-[1.15rem] font-bold text-[#173c70]">Bachpan</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#ef3e32]">Dresses</div>
    </div>
  </div>;
}

function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <div className="app-shell flex flex-col md:flex-row">
    <aside className="hidden w-[245px] shrink-0 border-r border-[#dcd4c4] bg-[#fffaf1] px-5 py-6 md:flex md:min-h-dvh md:flex-col">
      <Logo />
      <div className="mt-12 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8690a0]">Register</div>
      <nav className="mt-3 space-y-1.5" aria-label="Main navigation">
        <NavLink href="/" icon={<LayoutDashboard size={17} />} label="Overview" active={location === '/'} testId="link-overview" />
        <NavLink href="/item/new" icon={<Plus size={17} />} label="Add new item" active={location === '/item/new'} testId="link-add-item" />
      </nav>
      <div className="mt-8 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8690a0]">Tools</div>
      <nav className="mt-3 space-y-1.5">
        <NavLink href="/settings" icon={<Settings size={17} />} label="Backup & settings" active={location === '/settings'} testId="link-settings" />
      </nav>
      <div className="mt-auto rounded-2xl border border-[#eadfca] bg-[#fff3c9] p-4">
        <div className="flex items-center gap-2 text-xs font-bold text-[#173c70]"><span className="status-dot" /> Saved on this device</div>
        <p className="mt-2 text-[11px] leading-4 text-[#63718a]">Works without internet. Your register stays in this browser.</p>
      </div>
    </aside>
    <header className="flex items-center justify-between border-b border-[#dcd4c4] bg-[#fffaf1] px-4 py-4 md:hidden">
      <Logo />
      <Link href="/settings" className="rounded-xl p-2 text-[#173c70] hover:bg-[#f0e8d8]" data-testid="link-mobile-settings"><Settings size={19} /></Link>
    </header>
    <main className="min-w-0 flex-1">{children}</main>
  </div>;
}

function NavLink({ href, icon, label, active, testId }: { href: string; icon: ReactNode; label: string; active: boolean; testId: string }) {
  return <Link href={href} data-testid={testId} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${active ? 'bg-[#173c70] text-[#fffaf1] shadow-[3px_3px_0_#f3bd2c]' : 'text-[#5d6c84] hover:bg-[#f0e8d8] hover:text-[#173c70]'}`}>
    {icon}<span>{label}</span>{active && <ChevronRight size={15} className="ml-auto opacity-70" />}
  </Link>;
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#ef3e32]"><span className="h-1.5 w-1.5 rounded-full bg-[#f3bd2c]" />{eyebrow}</div>
      <h1 className="brand-display text-4xl font-bold leading-none text-[#173c70] md:text-5xl">{title}</h1>
      {description && <p className="mt-3 max-w-xl text-sm text-[#68758a]">{description}</p>}
    </div>
    {action}
  </div>;
}

function Toast({ message, tone, onClose }: { message: string; tone: 'success' | 'error'; onClose: () => void }) {
  return <div className={`fixed bottom-5 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-xl ${tone === 'success' ? 'bg-[#173c70] text-[#fffaf1]' : 'bg-[#ef3e32] text-white'}`} role="status" data-testid="status-toast">
    {tone === 'success' ? <Check size={17} /> : <CircleAlert size={17} />}{message}<button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100" aria-label="Close notification" data-testid="button-close-toast"><X size={15} /></button>
  </div>;
}

function useToast() {
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = (message: string, tone: 'success' | 'error' = 'success') => {
    setToast({ message, tone });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 3200);
  };
  return { toast, show, clear: () => setToast(null) };
}

function StatCard({ icon, label, value, accent }: { icon: ReactNode; label: string; value: string | number; accent: 'yellow' | 'blue' | 'red' }) {
  const colors = { yellow: 'bg-[#fff1b7] text-[#173c70]', blue: 'bg-[#e2edfa] text-[#173c70]', red: 'bg-[#ffe2dc] text-[#b92e28]' };
  return <div className="paper-card flex items-center gap-4 p-4 md:p-5" data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`}>
    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${colors[accent]}`}>{icon}</div>
    <div><div className="text-2xl font-bold tracking-tight text-[#173c70]">{value}</div><div className="mt-0.5 text-xs font-semibold text-[#7c8796]">{label}</div></div>
  </div>;
}

function Dashboard() {
  const [items, setItems] = useState<Item[]>([]);
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const { toast, show, clear } = useToast();
  useEffect(() => { Promise.all([getItems(), getEntries()]).then(([loadedItems, loadedEntries]) => { setItems(loadedItems.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))); setEntries(loadedEntries); }).catch(() => setLoadError(true)).finally(() => setLoading(false)); }, []);
  const filtered = useMemo(() => items.filter((item) => `${item.name} ${item.category}`.toLowerCase().includes(search.toLowerCase())), [items, search]);
  const recent = useMemo(() => [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4), [items]);
  const recentEntries = useMemo(() => [...entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5), [entries]);
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  return <Shell><div className="mx-auto max-w-[1320px] px-4 py-7 sm:px-7 md:px-10 md:py-10">
    <PageHeader eyebrow="Stock register" title="Good morning, keep counting." description="Your uniform register, ready whenever the shop is." action={<Link href="/item/new" className="ink-button inline-flex items-center justify-center gap-2 rounded-xl bg-[#ef3e32] px-4 py-3 text-sm font-bold text-white shadow-[3px_3px_0_#b92e28]" data-testid="button-add-item"><Plus size={18} /> Add new item</Link>} />
    {loadError ? <div className="mt-10 rounded-2xl border border-[#f1b5ad] bg-[#fff0ed] p-7 text-center"><CircleAlert className="mx-auto text-[#ef3e32]" /><h2 className="mt-3 font-bold text-[#173c70]">Could not open the register</h2><p className="mt-1 text-sm text-[#68758a]">Please refresh the page and try again.</p><button onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-[#173c70] px-4 py-2 text-sm font-bold text-white" data-testid="button-reload">Try again</button></div> : <>
      <div className="mt-9 grid gap-3 sm:grid-cols-3 fade-up">
        <StatCard icon={<ClipboardList size={21} />} label="Items in register" value={loading ? '—' : items.length} accent="blue" />
        <StatCard icon={<Archive size={21} />} label="Total pieces recorded" value={loading ? '—' : entries.reduce((sum, entry) => sum + totalForEntry(entry), 0).toLocaleString('en-IN')} accent="yellow" />
        <StatCard icon={<CalendarDays size={21} />} label="Entries this month" value={loading ? '—' : entries.filter((entry) => entry.date.slice(0, 7) === new Date().toISOString().slice(0, 7)).length} accent="red" />
      </div>
      <div className="mt-9 grid gap-8 lg:grid-cols-[1.35fr_.85fr]">
        <section className="fade-up-delay">
          <div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="brand-display text-2xl font-bold text-[#173c70]">Find an item</h2><p className="mt-1 text-sm text-[#7b8492]">Open an item to add or check stock entries.</p></div><span className="rounded-full bg-[#e9f0f7] px-3 py-1 text-xs font-bold text-[#42648b]">{filtered.length} shown</span></div>
          <div className="relative mb-4"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8994a5]" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by item or category…" className="w-full rounded-xl border border-[#d9d0c0] bg-[#fffdf8] py-3 pl-11 pr-4 text-sm text-[#173c70] outline-none transition focus:border-[#315f98] focus:ring-2 focus:ring-[#315f98]/15" data-testid="input-search-items" /></div>
          {loading ? <div className="space-y-2">{[1, 2, 3].map((number) => <div key={number} className="h-[76px] animate-pulse rounded-xl bg-[#eee7da]" />)}</div> : filtered.length === 0 ? <EmptyItems search={search} /> : <div className="space-y-2">{filtered.map((item) => <ItemRow key={item.id} item={item} entries={entries.filter((entry) => entry.itemId === item.id)} />)}</div>}
        </section>
        <section className="fade-up-delay-2">
          <div className="mb-4 flex items-end justify-between"><div><h2 className="brand-display text-2xl font-bold text-[#173c70]">Recently touched</h2><p className="mt-1 text-sm text-[#7b8492]">The items you updated last.</p></div></div>
          <div className="paper-card overflow-hidden">{recent.length === 0 ? <div className="p-8 text-center text-sm text-[#7b8492]">Your recent items will appear here.</div> : recent.map((item, index) => <Link key={item.id} href={`/item/${item.id}`} data-testid={`link-recent-item-${item.id}`} className={`flex items-center gap-3 px-4 py-3.5 transition hover:bg-[#f8f1e4] ${index !== recent.length - 1 ? 'border-b border-[#ebe2d2]' : ''}`}><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e5eef8] text-[#315f98]"><Shirt size={17} /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold text-[#173c70]">{item.name}</div><div className="mt-0.5 text-xs text-[#8690a0]">{item.category} · {item.sizes.length} sizes</div></div><ChevronRight size={16} className="text-[#a7afba]" /></Link>)}</div>
          <div className="mt-7 rounded-2xl bg-[#173c70] p-5 text-[#fffaf1] shadow-[4px_4px_0_#f3bd2c]"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-[#f3bd2c]"><CloudOff size={15} /> Offline first</div><p className="mt-3 text-sm leading-6 text-[#d9e4f1]">No internet? No problem. Add challans on the counter and back up when you’re done.</p><Link href="/settings" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-white underline decoration-[#f3bd2c] underline-offset-4" data-testid="link-backup-card">Open backup tools <ChevronRight size={14} /></Link></div>
        </section>
      </div>
      <section className="mt-10 fade-up-delay-2"><div className="mb-4 flex items-end justify-between"><div><h2 className="brand-display text-2xl font-bold text-[#173c70]">Latest challans</h2><p className="mt-1 text-sm text-[#7b8492]">A quick view of recent stock received.</p></div><Link href="/item/new" className="text-xs font-bold text-[#315f98] underline underline-offset-4" data-testid="link-latest-add">Add another item</Link></div><div className="paper-card overflow-hidden">{recentEntries.length === 0 ? <div className="p-8 text-center text-sm text-[#7b8492]">No challans recorded yet.</div> : <div className="mobile-scroll"><table className="ledger-table text-left text-sm"><thead><tr><th className="px-4 py-3 font-bold">Item</th><th className="px-4 py-3 font-bold">Challan</th><th className="px-4 py-3 font-bold">Date</th><th className="px-4 py-3 text-right font-bold">Pieces</th></tr></thead><tbody>{recentEntries.map((entry) => <tr key={entry.id} data-testid={`row-latest-entry-${entry.id}`}><td className="px-4 py-3 font-semibold text-[#173c70]">{itemById.get(entry.itemId)?.name ?? 'Deleted item'}</td><td className="px-4 py-3 text-[#627086]">{entry.challanNumber}</td><td className="px-4 py-3 text-[#627086]">{shortDate(entry.date)}</td><td className="px-4 py-3 text-right font-bold text-[#173c70]">{totalForEntry(entry)}</td></tr>)}</tbody></table></div>}</div></section>
    </>}</div>{toast && <Toast {...toast} onClose={clear} />}</Shell>;
}

function EmptyItems({ search }: { search: string }) {
  return <div className="paper-card ruled-note p-8 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff1b7] text-[#173c70]"><Search size={20} /></div><h3 className="mt-4 font-bold text-[#173c70]">{search ? 'No matching items' : 'Your register is empty'}</h3><p className="mt-1 text-sm text-[#788397]">{search ? 'Try a different name or category.' : 'Start with the first uniform item on your shelf.'}</p>{!search && <Link href="/item/new" className="mt-4 inline-flex rounded-lg bg-[#ef3e32] px-3 py-2 text-xs font-bold text-white" data-testid="button-empty-add">Add first item</Link>}</div>;
}

function ItemRow({ item, entries }: { item: Item; entries: StockEntry[] }) {
  return <Link href={`/item/${item.id}`} data-testid={`link-item-${item.id}`} className="paper-card group flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:border-[#315f98] hover:shadow-[0_8px_20px_rgba(31,66,108,.12)]"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e7f0fa] text-[#315f98]"><Shirt size={20} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-bold text-[#173c70]">{item.name}</h3><span className="rounded-full bg-[#f8e9b7] px-2 py-0.5 text-[10px] font-bold text-[#80651b]">{item.category}</span></div><div className="mt-1 text-xs text-[#8590a0]">{item.sizes.length} sizes · {entries.length} {entries.length === 1 ? 'challan' : 'challans'} · {totalForItem(item, entries)} pieces</div></div><ChevronRight size={18} className="text-[#a4adba] transition group-hover:translate-x-1 group-hover:text-[#315f98]" /></Link>;
}

function Modal({ title, description, children, onClose, wide = false }: { title: string; description?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#173c70]/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" role="dialog" aria-modal="true"><div className={`modal-in max-h-[94dvh] w-full overflow-y-auto rounded-t-3xl bg-[#fffaf1] p-5 shadow-2xl sm:rounded-2xl sm:p-7 ${wide ? 'max-w-4xl' : 'max-w-lg'}`}><div className="flex items-start justify-between gap-5"><div><h2 className="brand-display text-2xl font-bold text-[#173c70]">{title}</h2>{description && <p className="mt-1 text-sm text-[#728096]">{description}</p>}</div><button onClick={onClose} className="rounded-lg p-1.5 text-[#728096] hover:bg-[#f0e8d8] hover:text-[#173c70]" aria-label="Close dialog" data-testid="button-close-dialog"><X size={19} /></button></div>{children}</div></div>;
}

function ItemFormModal({ item, onClose, onSaved }: { item?: Item; onClose: () => void; onSaved: (item: Item) => void }) {
  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState(item?.category ?? 'Uniform Set');
  const [sizes, setSizes] = useState(item?.sizes.join(', ') ?? '');
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const cleanSizes = Array.from(new Set(sizes.split(',').map((size) => size.trim()).filter(Boolean)));
    if (!name.trim()) { setError('Please enter an item name.'); return; }
    if (!cleanSizes.length) { setError('Add at least one size, like 24 or Medium.'); return; }
    const timestamp = now();
    const saved: Item = { id: item?.id ?? makeId('item'), name: name.trim(), category, sizes: cleanSizes, createdAt: item?.createdAt ?? timestamp, updatedAt: timestamp };
    await putItem(saved); onSaved(saved);
  };
  return <Modal title={item ? 'Edit item details' : 'Add a new item'} description="Keep the name clear — it is what you’ll search at the counter." onClose={onClose}><form onSubmit={submit} className="mt-6 space-y-5">
    <Field label="Item name" required><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Winter Sweater" className="form-input" data-testid="input-item-name" /></Field>
    <Field label="Category"><select value={category} onChange={(event) => setCategory(event.target.value)} className="form-input" data-testid="select-item-category">{categories.map((option) => <option key={option}>{option}</option>)}</select></Field>
    <Field label="Sizes" hint="Separate sizes with commas. You can use numbers, words, or both." required><input value={sizes} onChange={(event) => setSizes(event.target.value)} placeholder="e.g. 24, 26, 28, 30" className="form-input" data-testid="input-item-sizes" /></Field>
    {error && <div className="rounded-lg bg-[#fff0ed] px-3 py-2 text-xs font-semibold text-[#b92e28]" data-testid="status-item-form-error">{error}</div>}
    <div className="flex justify-end gap-2 border-t border-[#eadfca] pt-5"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-bold text-[#68758a] hover:bg-[#f0e8d8]" data-testid="button-cancel-item">Cancel</button><button type="submit" className="ink-button rounded-lg bg-[#173c70] px-5 py-2.5 text-sm font-bold text-white shadow-[3px_3px_0_#f3bd2c]" data-testid="button-save-item">{item ? 'Save changes' : 'Add item'}</button></div>
  </form></Modal>;
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-[#354d70]">{label}{required && <span className="ml-1 text-[#ef3e32]">*</span>}</span>{children}{hint && <span className="mt-1.5 block text-[11px] text-[#8994a5]">{hint}</span>}</label>;
}

function EntryFormModal({ item, entry, onClose, onSaved }: { item: Item; entry?: StockEntry; onClose: () => void; onSaved: (entry: StockEntry) => void }) {
  const [date, setDate] = useState(entry?.date ?? new Date().toISOString().slice(0, 10));
  const [challanNumber, setChallanNumber] = useState(entry?.challanNumber ?? '');
  const [quantities, setQuantities] = useState<Record<string, number>>(entry?.quantities ?? {});
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!date || !challanNumber.trim()) { setError('Date and challan number are needed.'); return; }
    if (!Object.values(quantities).some((quantity) => Number(quantity) > 0)) { setError('Enter at least one quantity.'); return; }
    const timestamp = now();
    const saved: StockEntry = { id: entry?.id ?? makeId('entry'), itemId: item.id, date, challanNumber: challanNumber.trim(), quantities: Object.fromEntries(item.sizes.map((size) => [size, Number(quantities[size]) || 0])), createdAt: entry?.createdAt ?? timestamp, updatedAt: timestamp };
    await putEntry(saved); onSaved(saved);
  };
  return <Modal title={entry ? 'Edit stock entry' : 'Add stock entry'} description={`${item.name} · enter the pieces received on one challan.`} onClose={onClose} wide><form onSubmit={submit} className="mt-6">
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Date" required><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="form-input" data-testid="input-entry-date" /></Field><Field label="Challan number" required><input autoFocus={!entry} value={challanNumber} onChange={(event) => setChallanNumber(event.target.value)} placeholder="e.g. CH-1062" className="form-input" data-testid="input-entry-challan" /></Field></div>
    <div className="mt-5 overflow-hidden rounded-xl border border-[#dcd4c4]"><table className="ledger-table text-sm"><thead><tr><th className="px-3 py-3 text-left font-bold">Size</th>{item.sizes.map((size) => <th key={size} className="px-2 py-3 text-center font-bold">{size}</th>)}</tr></thead><tbody><tr><td className="whitespace-nowrap px-3 py-3 font-bold text-[#173c70]">Quantity received</td>{item.sizes.map((size) => <td key={size} className="px-1.5 py-2"><input type="number" min="0" inputMode="numeric" value={quantities[size] ?? ''} onChange={(event) => setQuantities((current) => ({ ...current, [size]: Number(event.target.value) }))} className="w-full rounded-lg border border-[#d4ccbd] bg-[#fffdf8] px-2 py-2 text-center font-bold text-[#173c70] outline-none focus:border-[#315f98] focus:ring-2 focus:ring-[#315f98]/15" aria-label={`Quantity size ${size}`} data-testid={`input-quantity-${size}`} /></td>)}</tr></tbody></table></div>
    {error && <div className="mt-4 rounded-lg bg-[#fff0ed] px-3 py-2 text-xs font-semibold text-[#b92e28]" data-testid="status-entry-form-error">{error}</div>}
    <div className="mt-6 flex justify-end gap-2 border-t border-[#eadfca] pt-5"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-bold text-[#68758a] hover:bg-[#f0e8d8]" data-testid="button-cancel-entry">Cancel</button><button type="submit" className="ink-button rounded-lg bg-[#ef3e32] px-5 py-2.5 text-sm font-bold text-white shadow-[3px_3px_0_#b92e28]" data-testid="button-save-entry">{entry ? 'Save entry' : 'Add to register'}</button></div>
  </form></Modal>;
}

function ItemPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [item, setItem] = useState<Item | null>(null);
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [itemModal, setItemModal] = useState(false);
  const [entryModal, setEntryModal] = useState<{ open: boolean; entry?: StockEntry }>({ open: false });
  const [printOpen, setPrintOpen] = useState(false);
  const { toast, show, clear } = useToast();
  const load = () => Promise.all([getItem(id), getEntries(id)]).then(([loadedItem, loadedEntries]) => { setItem(loadedItem ?? null); setEntries(loadedEntries.sort((a, b) => b.date.localeCompare(a.date))); }).finally(() => setLoading(false));
  useEffect(() => { load().catch(() => show('Could not load this item.', 'error')); }, [id]);
  const filteredEntries = useMemo(() => entries.filter((entry) => `${entry.challanNumber} ${entry.date}`.toLowerCase().includes(search.toLowerCase())), [entries, search]);
  const totals = useMemo(() => item?.sizes.reduce((result, size) => ({ ...result, [size]: entries.reduce((sum, entry) => sum + (Number(entry.quantities[size]) || 0), 0) }), {} as Record<string, number>) ?? {}, [item, entries]);
  if (loading) return <Shell><div className="mx-auto max-w-6xl px-4 py-10 sm:px-7"><div className="h-7 w-36 animate-pulse rounded bg-[#e9e1d4]" /><div className="mt-5 h-14 w-2/3 animate-pulse rounded bg-[#e9e1d4]" /><div className="mt-10 h-64 animate-pulse rounded-2xl bg-[#eee7da]" /></div></Shell>;
  if (!item) return <Shell><div className="mx-auto max-w-lg px-4 py-24 text-center"><CircleAlert className="mx-auto text-[#ef3e32]" size={32} /><h1 className="brand-display mt-4 text-3xl font-bold text-[#173c70]">Item not found</h1><p className="mt-2 text-sm text-[#788397]">This item may have been removed from the register.</p><Link href="/" className="mt-5 inline-flex rounded-lg bg-[#173c70] px-4 py-2 text-sm font-bold text-white" data-testid="link-back-overview">Back to overview</Link></div></Shell>;
  const onItemSaved = (saved: Item) => { setItem(saved); setItemModal(false); show('Item details saved.'); };
  const onEntrySaved = (saved: StockEntry) => { setEntries((current) => [saved, ...current.filter((entry) => entry.id !== saved.id)].sort((a, b) => b.date.localeCompare(a.date))); setEntryModal({ open: false }); show(entryModal.entry ? 'Entry updated.' : 'Stock entry added.'); };
  const removeEntry = async (entry: StockEntry) => { if (!window.confirm(`Delete challan ${entry.challanNumber}? This cannot be undone.`)) return; await deleteEntry(entry.id); setEntries((current) => current.filter((candidate) => candidate.id !== entry.id)); show('Entry deleted.'); };
  const removeItem = async () => { if (!window.confirm(`Delete ${item.name} and all its entries? This cannot be undone.`)) return; await deleteItem(item.id); setLocation('/'); };
  return <Shell><div className="mx-auto max-w-[1320px] px-4 py-7 sm:px-7 md:px-10 md:py-10">
    <div className="mb-8 flex flex-wrap items-center justify-between gap-3"><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-[#627086] hover:text-[#173c70]" data-testid="link-back-dashboard"><ArrowLeft size={17} /> All items</Link><div className="flex gap-2"><button onClick={() => setItemModal(true)} className="inline-flex items-center gap-2 rounded-lg border border-[#d5ccbc] bg-[#fffdf8] px-3 py-2 text-xs font-bold text-[#4d607b] hover:bg-[#f2ebdf]" data-testid="button-edit-item"><Pencil size={14} /> Edit item</button><button onClick={removeItem} className="rounded-lg p-2 text-[#b92e28] hover:bg-[#fff0ed]" aria-label="Delete item" data-testid="button-delete-item"><Trash2 size={16} /></button></div></div>
    <PageHeader eyebrow={item.category} title={item.name} description={`${item.sizes.length} sizes · ${entries.length} ${entries.length === 1 ? 'challan' : 'challans'} · ${totalForItem(item, entries)} pieces recorded`} action={<div className="flex gap-2"><button onClick={() => setPrintOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-[#cdd5df] bg-[#fffdf8] px-3.5 py-3 text-sm font-bold text-[#315f98] hover:bg-[#edf3fa]" data-testid="button-print-preview"><Printer size={17} /> <span className="hidden sm:inline">Print preview</span></button><button onClick={() => setEntryModal({ open: true })} className="ink-button inline-flex items-center gap-2 rounded-xl bg-[#ef3e32] px-4 py-3 text-sm font-bold text-white shadow-[3px_3px_0_#b92e28]" data-testid="button-add-entry"><Plus size={18} /> Add entry</button></div>} />
    <section className="mt-9 paper-card overflow-hidden fade-up"><div className="flex flex-col gap-4 border-b border-[#eadfca] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><h2 className="brand-display text-2xl font-bold text-[#173c70]">Stock ledger</h2><p className="mt-1 text-xs text-[#8690a0]">Every row is one challan received.</p></div><div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8994a5]" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a challan…" className="w-full rounded-lg border border-[#d9d0c0] bg-[#fffdf8] py-2 pl-9 pr-3 text-xs outline-none focus:border-[#315f98]" data-testid="input-search-entries" /></div></div>
      <div className="mobile-scroll"><table className="ledger-table text-sm"><thead><tr><th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">Date</th><th className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">Challan no.</th>{item.sizes.map((size) => <th key={size} className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide">{size}</th>)}<th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide">Total</th><th className="no-print w-24 px-2 py-3" /></tr></thead><tbody>{filteredEntries.map((entry) => <tr key={entry.id} data-testid={`row-entry-${entry.id}`}><td className="whitespace-nowrap px-4 py-3.5 font-semibold text-[#173c70]">{formatDate(entry.date)}</td><td className="whitespace-nowrap px-4 py-3.5 text-[#5f6e84]">{entry.challanNumber}</td>{item.sizes.map((size) => <td key={size} className="px-4 py-3.5 text-center text-[#4f6079]">{entry.quantities[size] || '—'}</td>)}<td className="px-4 py-3.5 text-right font-bold text-[#173c70]">{totalForEntry(entry)}</td><td className="no-print px-2 py-3.5"><div className="flex justify-end gap-1"><button onClick={() => setEntryModal({ open: true, entry })} className="rounded-md p-1.5 text-[#627086] hover:bg-[#e9f0f7] hover:text-[#315f98]" aria-label={`Edit ${entry.challanNumber}`} data-testid={`button-edit-entry-${entry.id}`}><Pencil size={14} /></button><button onClick={() => removeEntry(entry)} className="rounded-md p-1.5 text-[#9a7b79] hover:bg-[#fff0ed] hover:text-[#b92e28]" aria-label={`Delete ${entry.challanNumber}`} data-testid={`button-delete-entry-${entry.id}`}><Trash2 size={14} /></button></div></td></tr>)}</tbody></table></div>
      {filteredEntries.length === 0 && <div className="p-10 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff1b7] text-[#173c70]"><ClipboardList size={20} /></div><h3 className="mt-3 font-bold text-[#173c70]">{search ? 'No matching challans' : 'No entries yet'}</h3><p className="mt-1 text-sm text-[#7d899b]">{search ? 'Try searching by a different number.' : 'Record the first stock delivery for this item.'}</p>{!search && <button onClick={() => setEntryModal({ open: true })} className="mt-4 rounded-lg bg-[#ef3e32] px-4 py-2 text-xs font-bold text-white" data-testid="button-empty-add-entry">Add first entry</button>}</div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eadfca] bg-[#fffdf8] px-4 py-4 sm:px-5"><span className="text-xs font-bold uppercase tracking-wide text-[#788397]">Size-wise totals</span><div className="flex flex-wrap gap-2">{item.sizes.map((size) => <span key={size} className="size-pill rounded-lg px-2.5 py-1.5 text-xs font-bold" data-testid={`text-total-size-${size}`}>{size}: {totals[size] || 0}</span>)}</div></div>
    </section>
    {entryModal.open && <EntryFormModal item={item} entry={entryModal.entry} onClose={() => setEntryModal({ open: false })} onSaved={onEntrySaved} />}{itemModal && <ItemFormModal item={item} onClose={() => setItemModal(false)} onSaved={onItemSaved} />}{printOpen && <PrintPreview item={item} entries={filteredEntries} onClose={() => setPrintOpen(false)} />}
  </div>{toast && <Toast {...toast} onClose={clear} />}</Shell>;
}

function PrintPreview({ item, entries, onClose }: { item: Item; entries: StockEntry[]; onClose: () => void }) {
  const sizeTotals = item.sizes.reduce<Record<string, number>>((result, size) => {
    result[size] = entries.reduce((sum, entry) => sum + (Number(entry.quantities[size]) || 0), 0);
    return result;
  }, {});
  const totalPieces = entries.reduce((sum, entry) => sum + totalForEntry(entry), 0);

  return <Modal title="Print preview" description="A4 portrait · only the clean stock list will print." onClose={onClose} wide>
    <div className="mt-5 rounded-xl border border-[#dcd4c4] bg-[#e8e2d7] p-3 sm:p-6">
      <div className="print-sheet mx-auto bg-white p-5 shadow-md sm:p-8">
        <div className="print-heading flex items-start justify-between border-b-2 border-[#173c70] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ef3e32] text-white"><Shirt size={20} /></div>
            <div>
              <div className="brand-display text-xl font-bold text-[#173c70]">Bachpan Dresses</div>
              <div className="text-[9px] font-bold uppercase tracking-[.2em] text-[#ef3e32]">Stock register</div>
            </div>
          </div>
          <div className="text-right text-[10px] text-[#68758a]">Printed on<br /><strong>{formatDate(new Date().toISOString().slice(0, 10))}</strong></div>
        </div>
        <h2 className="brand-display mt-5 text-center text-2xl font-bold text-[#173c70]">Stock / Item List</h2>
        <div className="print-item-meta mt-4 grid grid-cols-2 gap-4 border-y border-[#bcc5d0] py-3 text-xs">
          <div><span className="text-[#788397]">Item Name</span><div className="mt-1 font-bold text-[#173c70]">{item.name}</div></div>
          <div><span className="text-[#788397]">Category</span><div className="mt-1 font-bold text-[#173c70]">{item.category}</div></div>
        </div>
        <table className="print-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Challan<br />Number</th>
              {item.sizes.map((size) => <th key={size}>{size}</th>)}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => <tr key={entry.id}>
              <td>{formatDate(entry.date)}</td>
              <td>{entry.challanNumber}</td>
              {item.sizes.map((size) => <td key={size}>{entry.quantities[size] || 0}</td>)}
              <td><strong>{totalForEntry(entry)}</strong></td>
            </tr>)}
            {entries.length === 0 && <tr><td colSpan={item.sizes.length + 3}>No stock entries recorded.</td></tr>}
          </tbody>
          <tfoot>
            <tr>
              <th>Total</th>
              <th>—</th>
              {item.sizes.map((size) => <th key={size}>{sizeTotals[size]}</th>)}
              <th>{totalPieces}</th>
            </tr>
          </tfoot>
        </table>
        <div className="print-total mt-4 text-right text-xs font-bold text-[#173c70]">Total pieces: {totalPieces}</div>
      </div>
    </div>
    <div className="no-print mt-5 flex justify-end gap-2">
      <button onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-bold text-[#68758a] hover:bg-[#f0e8d8]">Close</button>
      <button onClick={() => window.print()} className="ink-button inline-flex items-center gap-2 rounded-lg bg-[#173c70] px-5 py-2.5 text-sm font-bold text-white shadow-[3px_3px_0_#f3bd2c]" data-testid="button-print"><Printer size={16} /> Print list</button>
    </div>
  </Modal>;
}

function AddItemPage() {
  const [, setLocation] = useLocation();
  return <Shell><div className="mx-auto max-w-2xl px-4 py-7 sm:px-7 md:px-10 md:py-10"><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-[#627086] hover:text-[#173c70]" data-testid="link-back-add"><ArrowLeft size={17} /> All items</Link><div className="mt-10 paper-card p-5 sm:p-8"><PageHeader eyebrow="New register item" title="What are you stocking?" description="Add an item once, then record each delivery against it." /><div className="mt-7"><ItemFormModalContent onSaved={(item) => setLocation(`/item/${item.id}`)} /></div></div></div></Shell>;
}

function ItemFormModalContent({ onSaved }: { onSaved: (item: Item) => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Uniform Set');
  const [sizes, setSizes] = useState('');
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => { event.preventDefault(); const cleanSizes = Array.from(new Set(sizes.split(',').map((size) => size.trim()).filter(Boolean))); if (!name.trim()) { setError('Please enter an item name.'); return; } if (!cleanSizes.length) { setError('Add at least one size, like 24 or Medium.'); return; } const timestamp = now(); const saved: Item = { id: makeId('item'), name: name.trim(), category, sizes: cleanSizes, createdAt: timestamp, updatedAt: timestamp }; await putItem(saved); onSaved(saved); };
  return <form onSubmit={submit} className="space-y-5"><Field label="Item name" required><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Winter Sweater" className="form-input" data-testid="input-new-item-name" /></Field><Field label="Category"><select value={category} onChange={(event) => setCategory(event.target.value)} className="form-input" data-testid="select-new-item-category">{categories.map((option) => <option key={option}>{option}</option>)}</select></Field><Field label="Sizes" hint="Separate sizes with commas. You can use numbers, words, or both." required><input value={sizes} onChange={(event) => setSizes(event.target.value)} placeholder="e.g. 24, 26, 28, 30" className="form-input" data-testid="input-new-item-sizes" /></Field>{error && <div className="rounded-lg bg-[#fff0ed] px-3 py-2 text-xs font-semibold text-[#b92e28]" data-testid="status-new-item-error">{error}</div>}<div className="flex justify-end border-t border-[#eadfca] pt-5"><button type="submit" className="ink-button inline-flex items-center gap-2 rounded-lg bg-[#ef3e32] px-5 py-3 text-sm font-bold text-white shadow-[3px_3px_0_#b92e28]" data-testid="button-create-item"><Plus size={17} /> Create item</button></div></form>;
}

function SettingsPage() {
  const [status, setStatus] = useState<'idle' | 'working'>('idle');
  const { toast, show, clear } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const downloadBackup = async () => { setStatus('working'); try { const data = await exportData(); const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `bachpan-register-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url); show('Backup downloaded. Keep it somewhere safe.'); } catch { show('Could not create backup.', 'error'); } finally { setStatus('idle'); } };
  const restoreBackup = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; try { const parsed = JSON.parse(await file.text()) as Partial<BackupData>; if (parsed.version !== 1 || !Array.isArray(parsed.items) || !Array.isArray(parsed.entries) || !parsed.items.every(isValidItem) || !parsed.entries.every(isValidEntry)) throw new Error('invalid'); if (!window.confirm(`Replace this register with ${parsed.items.length} items and ${parsed.entries.length} entries from this backup?`)) return; setStatus('working'); await replaceAll(parsed.items, parsed.entries); show('Backup restored. The register is up to date.'); setTimeout(() => window.location.reload(), 500); } catch { show('That file is not a valid Bachpan backup.', 'error'); } finally { setStatus('idle'); } };
  return <Shell><div className="mx-auto max-w-4xl px-4 py-7 sm:px-7 md:px-10 md:py-10"><PageHeader eyebrow="Tools" title="Backup & settings" description="Your register is stored on this device. Make a backup before changing phones or browsers." /><div className="mt-9 grid gap-5 md:grid-cols-2"><section className="paper-card p-5 sm:p-6"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff1b7] text-[#80651b]"><Download size={20} /></div><h2 className="brand-display mt-5 text-2xl font-bold text-[#173c70]">Download a backup</h2><p className="mt-2 text-sm leading-6 text-[#728096]">Save all items and challan entries as one JSON file. You can keep it on a pen drive or send it to yourself.</p><button onClick={downloadBackup} disabled={status === 'working'} className="ink-button mt-6 inline-flex items-center gap-2 rounded-lg bg-[#173c70] px-4 py-3 text-sm font-bold text-white shadow-[3px_3px_0_#f3bd2c]" data-testid="button-download-backup"><Download size={16} /> {status === 'working' ? 'Preparing…' : 'Download JSON backup'}</button></section><section className="paper-card p-5 sm:p-6"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e2edfa] text-[#315f98]"><Upload size={20} /></div><h2 className="brand-display mt-5 text-2xl font-bold text-[#173c70]">Restore a backup</h2><p className="mt-2 text-sm leading-6 text-[#728096]">Choose a Bachpan backup file to replace the register on this device. We’ll ask before replacing anything.</p><input ref={fileInput} type="file" accept="application/json,.json" onChange={restoreBackup} className="hidden" data-testid="input-restore-backup" /><button onClick={() => fileInput.current?.click()} disabled={status === 'working'} className="ink-button mt-6 inline-flex items-center gap-2 rounded-lg border border-[#b8c7d8] bg-[#edf3fa] px-4 py-3 text-sm font-bold text-[#315f98]" data-testid="button-restore-backup"><Upload size={16} /> Choose backup file</button></section></div><section className="paper-card mt-5 flex items-start gap-4 p-5 sm:p-6"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e1f2e7] text-[#2d8c5d]"><HardDrive size={20} /></div><div><h2 className="font-bold text-[#173c70]">Local and offline</h2><p className="mt-1 text-sm leading-6 text-[#728096]">This app uses IndexedDB — a small, private storage space in your browser. No account, server, or internet connection is needed. Your data stays on this device until you clear browser data.</p><div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#e1f2e7] px-3 py-1.5 text-xs font-bold text-[#2d8c5d]"><span className="status-dot" /> Local storage is active</div></div></section><div className="mt-8 flex items-center gap-2 text-xs text-[#8994a5]"><FileJson size={15} /> Backup files are plain JSON and can be moved between devices.</div></div>{toast && <Toast {...toast} onClose={clear} />}</Shell>;
}

function isValidItem(value: unknown): value is Item {
  if (!value || typeof value !== 'object') return false;
  const item = value as Item;
  return typeof item.id === 'string' && typeof item.name === 'string' && typeof item.category === 'string' && Array.isArray(item.sizes) && item.sizes.every((size) => typeof size === 'string') && typeof item.createdAt === 'string' && typeof item.updatedAt === 'string';
}
function isValidEntry(value: unknown): value is StockEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as StockEntry;
  return typeof entry.id === 'string' && typeof entry.itemId === 'string' && typeof entry.date === 'string' && typeof entry.challanNumber === 'string' && !!entry.quantities && typeof entry.quantities === 'object' && Object.values(entry.quantities).every((quantity) => typeof quantity === 'number' && quantity >= 0) && typeof entry.createdAt === 'string' && typeof entry.updatedAt === 'string';
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={Dashboard} /><Route path="/item/new" component={AddItemPage} /><Route path="/item/:id" component={ItemPage} /><Route path="/settings" component={SettingsPage} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter></QueryClientProvider>;
}

export default App;