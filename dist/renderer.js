"use strict";
(() => {
    const saveForm = document.getElementById('save-form');
    const linkInput = document.getElementById('link-input');
    const toast = document.getElementById('toast');
    const breadcrumb = document.getElementById('breadcrumb');
    const view = document.getElementById('view');
    const INBOX_ID = 'general';
    // Lets CSS leave room for the window controls (macOS: left, others: right).
    document.documentElement.classList.add(`platform-${window.api.platform}`);
    if (window.api.platform === 'darwin') {
        document.querySelectorAll('.paste-hint kbd:first-child').forEach((k) => (k.textContent = '⌘'));
    }
    // Keep the native window controls in step with whatever backdrop is showing.
    // Every dialog (panel, save, folder editor, photo viewer) is added to <body> while open.
    let titleBarTint = 'none';
    new MutationObserver(() => {
        const tint = document.body.querySelector(':scope > dialog.lightbox')
            ? 'dark'
            : document.body.querySelector(':scope > dialog')
                ? 'dim'
                : 'none';
        if (tint !== titleBarTint) {
            titleBarTint = tint;
            window.api.setTitleBarTint(tint);
        }
    }).observe(document.body, { childList: true });
    // ---------- Small helpers ----------
    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className)
            node.className = className;
        if (text !== undefined)
            node.textContent = text;
        return node;
    }
    // One stroke-icon set (24px grid, drawn with currentColor) instead of text glyphs,
    // which render at different sizes and weights per font.
    const ICON_PATHS = {
        x: 'M18 6 6 18M6 6l12 12',
        'arrow-left': 'M19 12H5M12 19l-7-7 7-7',
        'arrow-right': 'M5 12h14M12 5l7 7-7 7',
        more: 'M5 12h.01M12 12h.01M19 12h.01',
        check: 'M20 6 9 17l-5-5',
        plus: 'M12 5v14M5 12h14',
        external: 'M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
        chevron: 'm9 18 6-6-6-6',
        edit: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z',
        trash: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6',
        copy: 'M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2zM16 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4',
        folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
        inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
    };
    function icon(name, size = 16) {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', String(size));
        svg.setAttribute('height', String(size));
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', name === 'more' ? '3' : '1.75');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.setAttribute('aria-hidden', 'true');
        svg.classList.add('icon');
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', ICON_PATHS[name]);
        svg.appendChild(path);
        return svg;
    }
    function withIcon(node, name, size) {
        node.prepend(icon(name, size));
        return node;
    }
    let toastTimer;
    function showToast(message, isError = false, autoHide = true, action) {
        toast.replaceChildren(el('span', '', message));
        if (action) {
            const button = el('button', 'toast-action', action.label);
            button.type = 'button';
            button.addEventListener('click', () => {
                toast.hidden = true;
                action.run();
            });
            toast.appendChild(button);
        }
        toast.className = isError ? 'toast toast-error' : 'toast';
        toast.hidden = false;
        window.clearTimeout(toastTimer);
        if (autoHide) {
            toastTimer = window.setTimeout(() => {
                toast.hidden = true;
            }, action ? 6000 : 4000);
        }
    }
    function timeAgo(iso) {
        if (!iso)
            return '';
        const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
        if (seconds < 60)
            return 'just now';
        // Each step: how many of the current unit make the next one.
        const steps = [
            [60, 'h'],
            [24, 'd'],
            [7, 'w'],
            [4.35, 'mo'],
            [12, 'y'],
        ];
        let value = seconds / 60;
        let label = 'm';
        for (const [size, next] of steps) {
            if (value < size)
                break;
            value /= size;
            label = next;
        }
        return `${Math.floor(value)}${label} ago`;
    }
    function shortDate(iso) {
        const date = new Date(iso);
        if (Number.isNaN(date.getTime()))
            return '';
        const sameYear = date.getFullYear() === new Date().getFullYear();
        return date.toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            year: sameYear ? undefined : 'numeric',
        });
    }
    function fullDate(iso) {
        const date = new Date(iso);
        if (Number.isNaN(date.getTime()))
            return '';
        return date.toLocaleString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    }
    function avatar(name, handle, size = 'sm') {
        const node = el('div', `avatar avatar-${size}`, (name || handle || '?').trim()[0].toUpperCase());
        let hash = 0;
        for (const ch of handle)
            hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
        node.style.background = `hsl(${hash % 360} 45% 38%)`;
        node.setAttribute('aria-hidden', 'true');
        return node;
    }
    // Tweet text with clickable links (opened in the user's browser).
    function richText(text, className) {
        const p = el('p', className);
        const parts = text.split(/(https?:\/\/[^\s]+)/g);
        parts.forEach((part, i) => {
            if (i % 2 === 1) {
                const a = el('a', 'link', part.replace(/^https?:\/\//, ''));
                a.href = part;
                a.target = '_blank';
                a.rel = 'noreferrer';
                p.appendChild(a);
            }
            else if (part) {
                p.appendChild(document.createTextNode(part));
            }
        });
        return p;
    }
    function mediaBadges(types) {
        if (types.length === 0)
            return null;
        const counts = new Map();
        for (const t of types)
            counts.set(t, (counts.get(t) ?? 0) + 1);
        const row = el('div', 'badges');
        const labels = { photo: 'Photo', video: 'Video', gif: 'GIF', animated_gif: 'GIF' };
        for (const [type, n] of counts) {
            const label = labels[type] ?? type;
            row.appendChild(el('span', 'badge', n > 1 && type === 'photo' ? `${label}s ×${n}` : label));
        }
        return row;
    }
    function emptyState(title, body) {
        const box = el('div', 'empty');
        box.append(el('p', 'empty-title', title), el('p', 'empty-body', body));
        return box;
    }
    function currentRoute() {
        const [, kind, id] = location.hash.replace(/^#/, '').split('/');
        if (kind === 'folder' && id)
            return { name: 'folder', id: decodeURIComponent(id) };
        if (kind === 'post' && id)
            return { name: 'post', id: decodeURIComponent(id) };
        return { name: 'home' };
    }
    const folderHref = (id) => `#/folder/${encodeURIComponent(id)}`;
    const postHref = (id) => `#/post/${encodeURIComponent(id)}`;
    function setBreadcrumb(items) {
        breadcrumb.replaceChildren();
        breadcrumb.hidden = items.length < 2; // Home needs no trail
        items.forEach((item, i) => {
            if (i > 0)
                breadcrumb.appendChild(withIcon(el('span', 'crumb-sep'), 'chevron', 14));
            if (item.href && i < items.length - 1) {
                const a = el('a', 'crumb', item.label);
                a.href = item.href;
                breadcrumb.appendChild(a);
            }
            else {
                breadcrumb.appendChild(el('span', 'crumb crumb-current', item.label));
            }
        });
    }
    // Each render gets a number; a slower, older render never overwrites a newer one.
    let renderId = 0;
    // What is drawn in the page behind any panel: 'home', 'folder:<id>' or 'missing'.
    let baseKey = '';
    let previousRoute = null;
    async function render() {
        const id = ++renderId;
        closeMenu();
        const route = currentRoute();
        const cameFrom = previousRoute;
        previousRoute = route;
        // A post opens as a panel over its folder's grid.
        if (route.name === 'post') {
            const post = await window.api.getPost(route.id);
            if (id !== renderId)
                return;
            if (!post) {
                closePanel();
                setBreadcrumb([{ label: 'Folders', href: '#/' }, { label: 'Not found' }]);
                const screen = el('section', 'screen');
                screen.appendChild(emptyState('Post not found', 'It may have been removed from the archive.'));
                view.replaceChildren(screen);
                baseKey = 'missing';
                return;
            }
            const key = `folder:${post.folderId}`;
            if (baseKey !== key) {
                const screen = await renderFolder(post.folderId);
                if (id !== renderId)
                    return;
                view.replaceChildren(screen);
                baseKey = key;
                window.scrollTo(0, 0);
            }
            await showPanel(post, cameFrom);
            return;
        }
        closePanel();
        const key = route.name === 'folder' ? `folder:${route.id}` : 'home';
        const keepScroll = key === baseKey; // e.g. closing the panel back to its folder
        const scrollY = window.scrollY;
        const screen = route.name === 'folder' ? await renderFolder(route.id) : await renderHome();
        if (id !== renderId)
            return;
        view.replaceChildren(screen);
        baseKey = key;
        window.scrollTo(0, keepScroll ? scrollY : 0);
    }
    // Redraw the folder grid behind an open panel, without touching the panel.
    async function refreshBase() {
        if (!baseKey.startsWith('folder:'))
            return;
        const scrollY = window.scrollY;
        const screen = await renderFolder(baseKey.slice('folder:'.length));
        view.replaceChildren(screen);
        window.scrollTo(0, scrollY);
        markCurrentCard();
    }
    // ---------- Screen 1: Home (folder grid) ----------
    // Same palette as FOLDER_COLORS in storage.ts (main validates every colour).
    const FOLDER_COLORS = ['#E5736B', '#E8A24A', '#D6C25A', '#5CC08B', '#4FB8C9', '#6C8CFF', '#A67CE8', '#E070A8'];
    // Folders deleted in the last few seconds, still undoable. id -> timer.
    const pendingDeletes = new Map();
    function visibleFolders(list) {
        return list.filter((f) => !pendingDeletes.has(f.id));
    }
    const SORT_KEY = 'tweet-archive.folder-sort';
    function readSort() {
        try {
            const value = localStorage.getItem(SORT_KEY);
            if (value === 'name' || value === 'count')
                return value;
        }
        catch {
            // storage unavailable
        }
        return 'recent';
    }
    function sortFolders(list, mode) {
        const byName = (a, b) => a.name.localeCompare(b.name);
        const rest = list.filter((f) => f.id !== INBOX_ID);
        if (mode === 'name')
            rest.sort(byName);
        else if (mode === 'count')
            rest.sort((a, b) => b.count - a.count || byName(a, b));
        else
            rest.sort((a, b) => (b.lastSavedAt ?? '').localeCompare(a.lastSavedAt ?? '') || byName(a, b));
        const inbox = list.filter((f) => f.id === INBOX_ID);
        return [...inbox, ...rest]; // Inbox always first
    }
    async function renderHome() {
        setBreadcrumb([{ label: 'Folders' }]);
        const folders = visibleFolders(await window.api.listFolderSummaries());
        const screen = el('section', 'screen');
        const header = el('div', 'screen-header screen-header-row');
        const titles = el('div');
        const total = folders.reduce((sum, f) => sum + f.count, 0);
        titles.append(el('h1', 'screen-title', 'Folders'), el('p', 'screen-subtitle', `${total} saved ${total === 1 ? 'post' : 'posts'}`));
        const sortLabel = el('label', 'sort-control');
        sortLabel.appendChild(el('span', '', 'Sort'));
        const sortSelect = el('select');
        sortSelect.append(new Option('Recently updated', 'recent'), new Option('Name', 'name'), new Option('Most posts', 'count'));
        sortSelect.value = readSort();
        sortLabel.appendChild(sortSelect);
        header.append(titles, sortLabel);
        screen.appendChild(header);
        const grid = el('div', 'folder-grid');
        const draw = () => {
            grid.replaceChildren(...sortFolders(folders, sortSelect.value).map(folderCard), newFolderTile());
        };
        sortSelect.addEventListener('change', () => {
            try {
                localStorage.setItem(SORT_KEY, sortSelect.value);
            }
            catch {
                // not remembered, still sorted
            }
            draw();
        });
        draw();
        screen.appendChild(grid);
        return screen;
    }
    function folderCard(folder) {
        const isInbox = folder.id === INBOX_ID;
        const card = el('div', 'folder-card');
        card.style.setProperty('--folder-color', folder.color);
        if (isInbox)
            card.classList.add('folder-card-inbox');
        const link = el('a', 'folder-link');
        link.href = folderHref(folder.id);
        const cover = el('div', `folder-cover folder-cover-${Math.max(1, folder.thumbs.length)}`);
        if (folder.thumbs.length === 0) {
            cover.appendChild(isInbox ? withIcon(el('span', 'folder-cover-initial'), 'inbox', 48) : el('span', 'folder-cover-initial', folder.name.trim()[0]?.toUpperCase() ?? '?'));
        }
        for (const url of folder.thumbs) {
            const img = el('img');
            img.src = url;
            img.alt = '';
            img.loading = 'lazy';
            cover.appendChild(img);
        }
        const body = el('div', 'folder-body');
        const titleRow = el('div', 'folder-title-row');
        titleRow.append(el('span', 'folder-dot'), el('span', 'folder-name', folder.name));
        if (isInbox && folder.count > 0)
            titleRow.appendChild(el('span', 'count-pill', String(folder.count)));
        let metaText;
        if (folder.count === 0)
            metaText = isInbox ? 'All sorted' : 'No posts yet';
        else
            metaText = `${folder.count} ${folder.count === 1 ? 'post' : 'posts'} · Updated ${timeAgo(folder.lastSavedAt)}`;
        body.append(titleRow, el('p', 'folder-meta', metaText));
        if (folder.description)
            body.appendChild(el('p', 'folder-desc', folder.description));
        link.append(cover, body);
        card.appendChild(link);
        if (!isInbox) {
            const menuButton = folderMenuButton(folder, folder.count);
            menuButton.classList.add('folder-card-menu');
            card.appendChild(menuButton);
        }
        return card;
    }
    function newFolderTile() {
        const tile = el('button', 'folder-card folder-new');
        tile.type = 'button';
        tile.append(withIcon(el('span', 'folder-new-plus'), 'plus', 28), el('span', '', 'New folder'));
        tile.addEventListener('click', () => openFolderEditor(null));
        return tile;
    }
    let openMenu = null;
    function closeMenu(returnFocus = false) {
        if (!openMenu)
            return;
        const { menu, button, cleanup } = openMenu;
        openMenu = null;
        cleanup();
        menu.remove();
        button.setAttribute('aria-expanded', 'false');
        button.classList.remove('is-open');
        if (returnFocus)
            button.focus();
    }
    // A ⋯ button that opens a menu built fresh each time (so it reflects current data).
    function menuButton(label, entries) {
        const button = withIcon(el('button', 'icon-button menu-button'), 'more', 18);
        button.type = 'button';
        button.setAttribute('aria-label', label);
        button.setAttribute('aria-haspopup', 'menu');
        button.setAttribute('aria-expanded', 'false');
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (openMenu?.button === button)
                closeMenu();
            else
                showMenu(button, label, entries());
        });
        return button;
    }
    function showMenu(button, label, entries) {
        closeMenu();
        const menu = el('div', 'menu');
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', label);
        for (const entry of entries) {
            if (entry === 'separator') {
                menu.appendChild(el('div', 'menu-separator'));
            }
            else if (entry instanceof HTMLElement) {
                menu.appendChild(entry);
            }
            else {
                const node = el('button', entry.danger ? 'menu-item menu-item-danger' : 'menu-item');
                node.type = 'button';
                node.setAttribute('role', 'menuitem');
                if (entry.icon)
                    node.appendChild(icon(entry.icon, 15));
                node.appendChild(el('span', '', entry.label));
                node.addEventListener('click', () => {
                    closeMenu();
                    entry.run();
                });
                menu.appendChild(node);
            }
        }
        document.body.appendChild(menu);
        // Position under the button: right-aligned to it, or left-aligned when
        // there's no room on the left; always kept inside the window.
        const rect = button.getBoundingClientRect();
        const width = menu.offsetWidth;
        const height = menu.offsetHeight;
        let left = rect.right - width;
        if (left < 8)
            left = rect.left;
        left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
        const below = rect.bottom + 4;
        const top = below + height > window.innerHeight - 8 ? rect.top - height - 4 : below;
        menu.style.left = `${left}px`;
        menu.style.top = `${Math.max(8, top)}px`;
        const focusables = () => [...menu.querySelectorAll('button')];
        const onPointer = (e) => {
            const target = e.target;
            if (!menu.contains(target) && !button.contains(target))
                closeMenu();
        };
        const onKey = (e) => {
            const items = focusables();
            const index = items.indexOf(document.activeElement);
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation(); // don't also trigger the page's "go up a level"
                closeMenu(true);
            }
            else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault();
                items[(index + 1) % items.length].focus();
            }
            else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault();
                items[(index - 1 + items.length) % items.length].focus();
            }
            else if (e.key === 'Tab') {
                closeMenu();
            }
        };
        const onScroll = () => closeMenu();
        document.addEventListener('mousedown', onPointer, true);
        document.addEventListener('keydown', onKey, true);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onScroll);
        openMenu = {
            menu,
            button,
            cleanup: () => {
                document.removeEventListener('mousedown', onPointer, true);
                document.removeEventListener('keydown', onKey, true);
                window.removeEventListener('scroll', onScroll, true);
                window.removeEventListener('resize', onScroll);
            },
        };
        button.setAttribute('aria-expanded', 'true');
        button.classList.add('is-open');
        focusables()[0]?.focus();
    }
    function folderMenuButton(folder, count) {
        return menuButton(`Options for ${folder.name}`, () => {
            const swatchRow = el('div', 'menu-swatches');
            swatchRow.setAttribute('role', 'group');
            swatchRow.setAttribute('aria-label', 'Colour');
            FOLDER_COLORS.forEach((color, i) => {
                const swatch = el('button', 'swatch');
                swatch.type = 'button';
                swatch.setAttribute('role', 'menuitemradio');
                swatch.setAttribute('aria-checked', String(color === folder.color));
                swatch.setAttribute('aria-label', `Colour ${i + 1}`);
                swatch.style.setProperty('--swatch', color);
                swatch.addEventListener('click', async () => {
                    closeMenu();
                    await window.api.updateFolder(folder.id, { color });
                    render();
                });
                swatchRow.appendChild(swatch);
            });
            return [
                { label: 'Edit folder…', icon: 'edit', run: () => openFolderEditor(folder) },
                swatchRow,
                'separator',
                { label: 'Delete folder', icon: 'trash', run: () => deleteFolderWithUndo(folder, count), danger: true },
            ];
        });
    }
    const tweetUrl = (post) => `https://x.com/${post.authorHandle}/status/${post.id}`;
    function postMenuButton(post) {
        return menuButton(`Options for post by @${post.authorHandle}`, () => [
            { label: 'Open on X', icon: 'external', run: () => window.open(tweetUrl(post), '_blank') },
            {
                label: 'Copy link',
                icon: 'copy',
                run: () => {
                    window.api.copyText(tweetUrl(post));
                    showToast('Link copied');
                },
            },
            { label: 'Move to…', icon: 'folder', run: () => movePost(post) },
            'separator',
            { label: 'Delete post', icon: 'trash', run: () => deletePostWithUndo(post), danger: true },
        ]);
    }
    // ---------- Moving and deleting posts ----------
    async function movePost(post) {
        const from = post.folderId;
        const to = await pickFolder({ title: 'Move to folder', current: from });
        if (!to || to === from)
            return;
        await window.api.savePostMeta(post.id, { folderId: to, note: post.note });
        const folders = await window.api.listFolders();
        const name = (id) => folders.find((f) => f.id === id)?.name ?? 'Inbox';
        showToast(`Moved to ${name(to)}`, false, true, {
            label: 'Undo',
            run: async () => {
                await window.api.savePostMeta(post.id, { folderId: from, note: post.note });
                showToast(`Moved back to ${name(from)}`);
                render();
            },
        });
        render();
    }
    // Posts deleted in the last few seconds, still undoable. id -> purge timer.
    const pendingPostDeletes = new Map();
    async function deletePostWithUndo(post) {
        // A playing video keeps its file open, which blocks moving the folder on Windows.
        if (panel?.postId === post.id) {
            panel.scroller.querySelectorAll('video').forEach((v) => {
                v.pause();
                v.removeAttribute('src');
                v.load();
            });
        }
        try {
            await window.api.trashPost(post.id);
        }
        catch {
            showToast('Couldn’t delete this post. A file may be in use. Try again in a moment.', true);
            if (panel?.postId === post.id)
                render();
            return;
        }
        // Permanently removed once the Undo window is over (or on next launch).
        // A little later than the toast (6s) hides, so a last-moment Undo still finds the files.
        const timer = window.setTimeout(() => {
            pendingPostDeletes.delete(post.id);
            window.api.purgeTrash(post.id);
        }, 7000);
        pendingPostDeletes.set(post.id, timer);
        if (panel && panel.postId === post.id) {
            // Move on to the next post (or the previous one at the end), or close.
            const index = panel.order.indexOf(post.id);
            const target = panel.order[index + 1] ?? panel.order[index - 1];
            if (index !== -1)
                panel.order.splice(index, 1);
            await refreshBase();
            if (target)
                location.replace(postHref(target));
            else
                leavePanel();
        }
        else if (panel) {
            await refreshBase();
        }
        else {
            render();
        }
        showToast(`Deleted post by @${post.authorHandle}`, false, true, {
            label: 'Undo',
            run: async () => {
                window.clearTimeout(timer);
                pendingPostDeletes.delete(post.id);
                try {
                    await window.api.restorePost(post.id);
                }
                catch {
                    showToast('Couldn’t restore the post. It may already be gone.', true);
                    return;
                }
                showToast('Post restored', false, true, { label: 'View', run: () => (location.hash = postHref(post.id)) });
                if (panel) {
                    await refreshBase();
                    panel.order = gridOrder(); // the restored post is back in the sequence
                    updatePanelNav();
                }
                else {
                    render();
                }
            },
        });
    }
    // ---------- Folder picker (used by "Move to…") ----------
    async function pickFolder(opts) {
        if (dialogOpen)
            return null;
        dialogOpen = true;
        let folders = visibleFolders(await window.api.listFolders());
        const recent = readRecent();
        let query = '';
        let active = 0;
        return new Promise((resolve) => {
            let settled = false;
            const dialog = el('dialog', 'modal');
            dialog.setAttribute('aria-labelledby', 'pick-folder-title');
            const head = el('div', 'dialog-head');
            const title = el('h2', 'dialog-title', opts.title);
            title.id = 'pick-folder-title';
            const closeButton = withIcon(el('button', 'icon-button'), 'x');
            closeButton.type = 'button';
            closeButton.setAttribute('aria-label', 'Close');
            head.append(title, closeButton);
            const filter = el('input', 'folder-filter');
            filter.type = 'text';
            filter.placeholder = 'Search or create a folder';
            filter.autocomplete = 'off';
            filter.spellcheck = false;
            filter.setAttribute('role', 'combobox');
            filter.setAttribute('aria-controls', 'pick-folder-options');
            filter.setAttribute('aria-expanded', 'true');
            filter.setAttribute('aria-label', 'Folder');
            const list = el('ul', 'folder-options');
            list.id = 'pick-folder-options';
            list.setAttribute('role', 'listbox');
            const body = el('div', 'dialog-body');
            body.append(filter, list);
            dialog.append(head, body);
            document.body.appendChild(dialog);
            const options = () => {
                const q = query.trim().toLowerCase();
                const rank = (f) => {
                    if (f.id === INBOX_ID)
                        return 10_000;
                    const r = recent.indexOf(f.id);
                    return r === -1 ? 1_000 : r;
                };
                const result = [...folders]
                    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
                    .filter((f) => f.name.toLowerCase().includes(q))
                    .map((folder) => ({ kind: 'folder', folder }));
                if (q && !folders.some((f) => f.name.toLowerCase() === q))
                    result.push({ kind: 'create', name: query.trim() });
                return result;
            };
            const finish = (value) => {
                if (settled)
                    return;
                settled = true;
                dialogOpen = false;
                dialog.close();
                dialog.remove();
                if (value)
                    rememberFolder(value);
                resolve(value);
            };
            const choose = async (opt) => {
                if (opt.kind === 'create') {
                    filter.disabled = true;
                    folders = visibleFolders(await window.api.addFolder(opt.name, ''));
                    const created = [...folders].reverse().find((f) => f.name === opt.name);
                    finish(created?.id ?? null);
                }
                else {
                    finish(opt.folder.id === opts.current ? null : opt.folder.id);
                }
            };
            const draw = () => {
                const opts2 = options();
                active = Math.min(active, Math.max(0, opts2.length - 1));
                list.replaceChildren();
                opts2.forEach((opt, i) => {
                    const item = el('li', 'folder-option');
                    item.id = `pick-folder-option-${i}`;
                    item.setAttribute('role', 'option');
                    if (opt.kind === 'create') {
                        item.classList.add('folder-option-create');
                        item.append(withIcon(el('span', 'folder-option-plus'), 'plus', 14), el('span', 'folder-option-name', `Create folder “${opt.name}”`));
                    }
                    else {
                        const dot = el('span', 'folder-dot');
                        dot.style.setProperty('--folder-color', opt.folder.color);
                        item.append(dot, el('span', 'folder-option-name', opt.folder.name));
                        if (opt.folder.id === opts.current) {
                            item.appendChild(el('span', 'folder-option-hint', 'current'));
                            item.setAttribute('aria-selected', 'true');
                        }
                    }
                    if (i === active) {
                        item.classList.add('is-active');
                        filter.setAttribute('aria-activedescendant', item.id);
                    }
                    item.addEventListener('mousedown', (e) => e.preventDefault());
                    item.addEventListener('click', () => choose(opt));
                    list.appendChild(item);
                });
                list.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
            };
            filter.addEventListener('input', () => {
                query = filter.value;
                active = 0;
                draw();
            });
            filter.addEventListener('keydown', (e) => {
                const count = options().length;
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (count)
                        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + count) % count;
                    draw();
                }
                else if (e.key === 'Enter') {
                    e.preventDefault();
                    const opt = options()[active];
                    if (opt)
                        choose(opt);
                }
            });
            dialog.addEventListener('keydown', (e) => {
                if (e.key !== 'Escape')
                    return;
                e.preventDefault();
                if (query) {
                    query = '';
                    filter.value = '';
                    active = 0;
                    draw();
                }
                else {
                    finish(null);
                }
            });
            dialog.addEventListener('close', () => finish(null));
            dialog.addEventListener('mousedown', (e) => {
                if (e.target === dialog)
                    finish(null);
            });
            closeButton.addEventListener('click', () => finish(null));
            // Start on the first folder that isn't the current one.
            active = Math.max(0, options().findIndex((o) => o.kind === 'folder' && o.folder.id !== opts.current));
            draw();
            dialog.showModal();
            filter.focus();
        });
    }
    // ---------- Delete with undo ----------
    function deleteFolderWithUndo(folder, count) {
        const timer = window.setTimeout(async () => {
            pendingDeletes.delete(folder.id);
            await window.api.deleteFolder(folder.id);
            render(); // Inbox count now includes the moved posts
        }, 6000);
        pendingDeletes.set(folder.id, timer);
        const route = currentRoute();
        if (route.name === 'folder' && route.id === folder.id)
            location.hash = '#/';
        else
            render();
        const moved = count > 0 ? ` · ${count} ${count === 1 ? 'post' : 'posts'} moved to Inbox` : '';
        showToast(`Deleted “${folder.name}”${moved}`, false, true, {
            label: 'Undo',
            run: () => {
                window.clearTimeout(timer);
                pendingDeletes.delete(folder.id);
                showToast(`Restored “${folder.name}”`);
                render();
            },
        });
    }
    // Closing the window during the undo period still deletes.
    window.addEventListener('beforeunload', () => {
        for (const id of pendingDeletes.keys())
            window.api.deleteFolder(id);
    });
    // ---------- Folder editor (create and edit) ----------
    async function openFolderEditor(folder) {
        if (dialogOpen)
            return;
        dialogOpen = true;
        const existing = visibleFolders(await window.api.listFolders());
        let color = folder?.color ?? FOLDER_COLORS[(existing.length - 1) % FOLDER_COLORS.length];
        let closed = false;
        const dialog = el('dialog', 'modal');
        dialog.setAttribute('aria-labelledby', 'folder-editor-title');
        const form = el('form');
        const head = el('div', 'dialog-head');
        const title = el('h2', 'dialog-title', folder ? 'Edit folder' : 'New folder');
        title.id = 'folder-editor-title';
        const closeButton = withIcon(el('button', 'icon-button'), 'x');
        closeButton.type = 'button';
        closeButton.setAttribute('aria-label', 'Close');
        head.append(title, closeButton);
        const field = (label, input, id) => {
            const wrap = el('div', 'field');
            const lab = el('label', 'field-label', label);
            lab.htmlFor = id;
            input.id = id;
            wrap.append(lab, input);
            return wrap;
        };
        const nameInput = el('input');
        nameInput.type = 'text';
        nameInput.maxLength = 60;
        nameInput.placeholder = 'e.g. Design inspiration';
        nameInput.value = folder?.name ?? '';
        nameInput.autocomplete = 'off';
        const descInput = el('input');
        descInput.type = 'text';
        descInput.maxLength = 140;
        descInput.placeholder = 'What goes in here? (optional)';
        descInput.value = folder?.description ?? '';
        const swatches = el('div', 'swatches');
        swatches.setAttribute('role', 'radiogroup');
        swatches.setAttribute('aria-label', 'Colour');
        const drawSwatches = () => {
            swatches.replaceChildren(...FOLDER_COLORS.map((c, i) => {
                const swatch = el('button', 'swatch swatch-lg');
                swatch.type = 'button';
                swatch.setAttribute('role', 'radio');
                swatch.setAttribute('aria-checked', String(c === color));
                swatch.setAttribute('aria-label', `Colour ${i + 1}`);
                swatch.style.setProperty('--swatch', c);
                swatch.addEventListener('click', () => {
                    color = c;
                    drawSwatches();
                    swatches.querySelector('[aria-checked=true]')?.focus();
                });
                return swatch;
            }));
        };
        drawSwatches();
        const colorField = el('div', 'field');
        colorField.append(el('span', 'field-label', 'Colour'), swatches);
        const errorText = el('p', 'field-error');
        errorText.setAttribute('role', 'alert');
        const body = el('div', 'dialog-body');
        body.append(field('Name', nameInput, 'folder-name-input'), errorText, field('Description', descInput, 'folder-desc-input'), colorField);
        const foot = el('div', 'dialog-foot');
        const spacer = el('span', 'dialog-status');
        const cancel = el('button', 'btn btn-ghost', 'Cancel');
        cancel.type = 'button';
        const submit = el('button', 'btn btn-primary', folder ? 'Save' : 'Create folder');
        submit.type = 'submit';
        foot.append(spacer, cancel, submit);
        form.append(head, body, foot);
        dialog.appendChild(form);
        document.body.appendChild(dialog);
        const close = () => {
            if (closed)
                return;
            closed = true;
            dialogOpen = false;
            dialog.close();
            dialog.remove();
        };
        const validate = () => {
            const name = nameInput.value.trim();
            if (!name)
                return 'Give the folder a name.';
            const lower = name.toLowerCase();
            const clash = existing.find((f) => f.id !== folder?.id && f.name.toLowerCase() === lower);
            if (clash)
                return `You already have a folder called “${clash.name}”.`;
            return null;
        };
        nameInput.addEventListener('input', () => {
            errorText.textContent = '';
            nameInput.removeAttribute('aria-invalid');
        });
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const problem = validate();
            if (problem) {
                errorText.textContent = problem;
                nameInput.setAttribute('aria-invalid', 'true');
                nameInput.focus();
                return;
            }
            submit.disabled = true;
            const name = nameInput.value.trim();
            const description = descInput.value.trim();
            if (folder) {
                await window.api.updateFolder(folder.id, { name, description, color });
                close();
                showToast('Folder updated');
            }
            else {
                const after = await window.api.addFolder(name, description, color);
                close();
                const created = [...after].reverse().find((f) => f.name === name);
                showToast(`Created “${name}”`, false, true, created ? { label: 'Open', run: () => (location.hash = folderHref(created.id)) } : undefined);
            }
            render();
        });
        cancel.addEventListener('click', close);
        closeButton.addEventListener('click', close);
        dialog.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                close();
            }
        });
        dialog.addEventListener('close', close);
        dialog.addEventListener('mousedown', (e) => {
            if (e.target === dialog)
                close();
        });
        dialog.showModal();
        nameInput.focus();
        nameInput.select();
    }
    // ---------- Screen 2: Folder view (tweet grid) ----------
    const folderQueries = new Map();
    async function renderFolder(folderId) {
        const [folders, posts] = await Promise.all([
            window.api.listFolders(),
            window.api.listPostsInFolder(folderId),
        ]);
        const folder = visibleFolders(folders).find((f) => f.id === folderId);
        const screen = el('section', 'screen');
        if (!folder) {
            setBreadcrumb([{ label: 'Folders', href: '#/' }, { label: 'Not found' }]);
            screen.appendChild(emptyState('This folder no longer exists', 'It may have been deleted.'));
            return screen;
        }
        setBreadcrumb([{ label: 'Folders', href: '#/' }, { label: folder.name }]);
        const header = el('div', 'screen-header screen-header-row');
        const titles = el('div');
        const title = el('h1', 'screen-title');
        const dot = el('span', 'folder-dot folder-dot-lg');
        dot.style.setProperty('--folder-color', folder.color);
        title.append(dot, document.createTextNode(folder.name));
        if (folder.id !== INBOX_ID)
            title.appendChild(folderMenuButton(folder, posts.length));
        titles.append(title, el('p', 'screen-subtitle', [folder.description, `${posts.length} ${posts.length === 1 ? 'post' : 'posts'}`]
            .filter(Boolean)
            .join(' · ')));
        header.appendChild(titles);
        const search = el('input', 'search-input');
        search.type = 'search';
        search.placeholder = 'Search this folder';
        search.value = folderQueries.get(folderId) ?? ''; // survives opening and closing posts
        search.addEventListener('input', () => folderQueries.set(folderId, search.value));
        if (posts.length > 0)
            header.appendChild(search);
        screen.appendChild(header);
        const grid = el('div', 'post-grid');
        screen.appendChild(grid);
        const draw = () => {
            const query = search.value.trim().toLowerCase();
            const matches = posts.filter((p) => `${p.text} ${p.authorHandle} ${p.authorName} ${p.note}`.toLowerCase().includes(query));
            grid.replaceChildren(...matches.map(postCard));
            if (posts.length === 0) {
                grid.replaceChildren(emptyState('Nothing here yet', folderId === INBOX_ID
                    ? 'Paste a tweet link in the bar above to save your first post.'
                    : 'Open a post and move it into this folder.'));
            }
            else if (matches.length === 0) {
                grid.replaceChildren(emptyState('No matches', `Nothing in ${folder.name} matches “${search.value.trim()}”.`));
            }
        };
        search.addEventListener('input', draw);
        draw();
        return screen;
    }
    // A card is a plain container with a "stretched" link covering it, so the ⋯
    // button can sit on top without nesting a button inside a link.
    function postCard(post) {
        const card = el('div', 'post-card');
        const link = el('a', 'post-link');
        link.href = postHref(post.id);
        link.setAttribute('aria-label', `Post by ${post.authorName || post.authorHandle}: ${post.text.slice(0, 80)}`);
        card.appendChild(link);
        const menu = postMenuButton(post);
        menu.classList.add('post-card-menu');
        card.appendChild(menu);
        const head = el('div', 'post-head');
        const who = el('div', 'post-who');
        who.append(el('span', 'post-name', post.authorName || post.authorHandle), el('span', 'post-handle', `@${post.authorHandle}`));
        head.append(avatar(post.authorName, post.authorHandle), who, el('span', 'post-date', shortDate(post.createdAt)));
        card.appendChild(head);
        // Previews drop blank lines so more of the post fits.
        if (post.text)
            card.appendChild(el('p', 'post-text', post.text.replace(/\n\s*\n+/g, '\n')));
        if (post.photoUrl) {
            const img = el('img', 'post-thumb');
            img.src = post.photoUrl;
            img.alt = '';
            img.loading = 'lazy';
            card.appendChild(img);
        }
        const foot = el('div', 'post-foot');
        const badges = mediaBadges(post.mediaTypes);
        if (badges)
            foot.appendChild(badges);
        if (post.note)
            foot.appendChild(el('span', 'post-note', post.note));
        if (foot.childElementCount > 0)
            card.appendChild(foot);
        return card;
    }
    // ---------- Screen 3: Tweet detail ----------
    // The tweet and its sidebar, shown inside the detail panel.
    function detailContent(post, folders) {
        const layout = el('div', 'detail');
        // Main column: the tweet itself.
        const main = el('article', 'detail-main');
        main.appendChild(tweetHeader(post, 'md'));
        if (post.replyingToId)
            main.appendChild(el('p', 'reply-context', 'Replying to another post'));
        if (post.text)
            main.appendChild(richText(post.text, 'detail-text'));
        const gallery = mediaGallery(post.media);
        if (gallery)
            main.appendChild(gallery);
        if (post.quoted)
            main.appendChild(quotedCard(post.quoted));
        main.appendChild(el('p', 'detail-date', fullDate(post.createdAt)));
        if (post.screenshotUrl) {
            const capture = el('details', 'capture');
            capture.appendChild(el('summary', '', 'Original capture'));
            const img = el('img');
            img.src = post.screenshotUrl;
            img.alt = 'Screenshot of the post as it appeared on X';
            capture.appendChild(img);
            main.appendChild(capture);
        }
        layout.append(main, detailSidebar(post, folders));
        return layout;
    }
    function tweetHeader(post, size) {
        const head = el('div', 'tweet-head');
        const who = el('div', 'post-who');
        who.append(el('span', 'post-name', post.authorName || post.authorHandle), el('span', 'post-handle', `@${post.authorHandle}`));
        head.append(avatar(post.authorName, post.authorHandle, size), who);
        return head;
    }
    function mediaGallery(media) {
        if (media.length === 0)
            return null;
        const gallery = el('div', `gallery gallery-${Math.min(media.length, 4)}`);
        const photoUrls = media.filter((m) => m.type === 'photo' && m.fileUrl).map((m) => m.fileUrl);
        for (const item of media) {
            const cell = el('div', 'gallery-cell');
            if (!item.fileUrl) {
                const missing = el('a', 'media-missing', 'Media not saved locally · Open original');
                missing.href = item.remoteUrl;
                missing.target = '_blank';
                missing.rel = 'noreferrer';
                cell.appendChild(missing);
            }
            else if (item.type === 'photo') {
                const url = item.fileUrl;
                const open = el('button', 'gallery-open');
                open.type = 'button';
                open.setAttribute('aria-label', photoUrls.length > 1 ? `View photo ${photoUrls.indexOf(url) + 1} of ${photoUrls.length}` : 'View photo');
                const img = el('img');
                img.src = url;
                img.alt = '';
                open.appendChild(img);
                open.addEventListener('click', () => openLightbox(photoUrls, photoUrls.indexOf(url)));
                cell.appendChild(open);
            }
            else {
                const isGif = item.type === 'gif' || item.type === 'animated_gif';
                const video = el('video');
                video.src = item.fileUrl;
                video.playsInline = true;
                video.preload = 'metadata';
                if (isGif) {
                    video.autoplay = true;
                    video.loop = true;
                    video.muted = true;
                    cell.appendChild(el('span', 'badge badge-overlay', 'GIF'));
                }
                else {
                    video.controls = true;
                }
                cell.appendChild(video);
            }
            gallery.appendChild(cell);
        }
        return gallery;
    }
    function quotedCard(quoted) {
        const card = el('div', 'quoted');
        card.appendChild(tweetHeader(quoted, 'sm'));
        if (quoted.text)
            card.appendChild(richText(quoted.text, 'quoted-text'));
        const gallery = mediaGallery(quoted.media);
        if (gallery)
            card.appendChild(gallery);
        return card;
    }
    function detailSidebar(post, folders) {
        const side = el('aside', 'detail-side');
        let folderId = post.folderId;
        let note = post.note;
        const status = el('span', 'save-status');
        let statusTimer;
        const persist = async () => {
            status.textContent = 'Saving…';
            await window.api.savePostMeta(post.id, { folderId, note });
            status.textContent = 'Saved';
            window.clearTimeout(statusTimer);
            statusTimer = window.setTimeout(() => (status.textContent = ''), 1500);
        };
        // Folder
        const folderField = el('label', 'field');
        folderField.appendChild(el('span', 'field-label', 'Folder'));
        const select = el('select');
        for (const f of folders)
            select.appendChild(new Option(f.name, f.id));
        select.value = folderId;
        select.addEventListener('change', async () => {
            folderId = select.value;
            await persist();
            const name = folders.find((f) => f.id === folderId)?.name ?? 'Inbox';
            showToast(`Moved to ${name}`);
            refreshBase(); // the grid behind the panel loses (or gains) this post
        });
        folderField.appendChild(select);
        // Note (saves itself while typing)
        const noteField = el('label', 'field');
        const noteLabel = el('span', 'field-label', 'Note');
        noteLabel.appendChild(status);
        noteField.appendChild(noteLabel);
        const textarea = el('textarea');
        textarea.rows = 4;
        textarea.placeholder = 'Why did you save this?';
        textarea.value = note;
        let noteTimer;
        textarea.addEventListener('input', () => {
            note = textarea.value.trim();
            window.clearTimeout(noteTimer);
            noteTimer = window.setTimeout(persist, 600);
        });
        noteField.appendChild(textarea);
        // Facts
        const facts = el('dl', 'facts');
        const addFact = (label, value) => {
            if (!value)
                return;
            facts.append(el('dt', '', label), el('dd', '', value));
        };
        addFact('Posted', fullDate(post.createdAt));
        addFact('Saved', fullDate(post.savedAt));
        const open = el('a', 'btn btn-block', 'Open on X');
        open.appendChild(icon('external', 15));
        open.href = post.url;
        open.target = '_blank';
        open.rel = 'noreferrer';
        const remove = withIcon(el('button', 'btn btn-block btn-danger-ghost', 'Delete post'), 'trash', 15);
        remove.type = 'button';
        remove.title = 'Delete post (Delete key)';
        remove.addEventListener('click', () => deletePostWithUndo(post));
        side.append(folderField, noteField, facts, open, remove);
        return side;
    }
    // ---------- Saving a link: the save dialog ----------
    // Quick check so junk never opens the dialog. main.ts does the real parsing.
    function looksLikeTweetLink(text) {
        return /^(https?:\/\/)?(www\.|mobile\.)?(twitter|x)\.com\/[^\s]*\/status(es)?\/\d+/i.test(text.trim());
    }
    const RECENT_KEY = 'tweet-archive.recent-folders';
    function readRecent() {
        try {
            const value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
            return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [];
        }
        catch {
            return [];
        }
    }
    function rememberFolder(id) {
        if (id === INBOX_ID)
            return;
        try {
            localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...readRecent().filter((r) => r !== id)].slice(0, 8)));
        }
        catch {
            // storage unavailable: recents just won't persist
        }
    }
    let dialogOpen = false;
    async function openSaveDialog(url) {
        if (dialogOpen)
            return;
        dialogOpen = true;
        let folders = visibleFolders(await window.api.listFolders());
        const recent = readRecent().filter((id) => folders.some((f) => f.id === id));
        let selected = recent[0] ?? INBOX_ID;
        let originalFolder = null; // set when the post was already saved
        let query = '';
        let active = 0;
        let navigated = false; // arrow keys used since the last pick
        let closed = false;
        let committing = false;
        let saveResult = null;
        let savePromise;
        // ----- Structure -----
        const dialog = el('dialog', 'modal');
        dialog.setAttribute('aria-labelledby', 'save-dialog-title');
        const head = el('div', 'dialog-head');
        const title = el('h2', 'dialog-title', 'Save post');
        title.id = 'save-dialog-title';
        const closeButton = withIcon(el('button', 'icon-button'), 'x');
        closeButton.type = 'button';
        closeButton.setAttribute('aria-label', 'Close');
        head.append(title, closeButton);
        const preview = el('div', 'save-preview');
        const folderLabel = el('label', 'field-label', 'Folder');
        folderLabel.htmlFor = 'folder-filter';
        const filter = el('input', 'folder-filter');
        filter.id = 'folder-filter';
        filter.type = 'text';
        filter.placeholder = 'Search or create a folder';
        filter.autocomplete = 'off';
        filter.spellcheck = false;
        filter.setAttribute('role', 'combobox');
        filter.setAttribute('aria-controls', 'folder-options');
        filter.setAttribute('aria-expanded', 'true');
        const list = el('ul', 'folder-options');
        list.id = 'folder-options';
        list.setAttribute('role', 'listbox');
        const noteInput = el('input', 'note-input');
        noteInput.type = 'text';
        noteInput.placeholder = 'Add a note (optional)';
        noteInput.maxLength = 500;
        const foot = el('div', 'dialog-foot');
        const status = el('span', 'dialog-status');
        const keepButton = el('button', 'btn btn-ghost', 'Keep in Inbox');
        keepButton.type = 'button';
        const confirmButton = el('button', 'btn btn-primary', 'Save');
        confirmButton.type = 'button';
        foot.append(status, keepButton, confirmButton);
        const body = el('div', 'dialog-body');
        body.append(preview, folderLabel, filter, list, noteInput);
        dialog.append(head, body, foot);
        document.body.appendChild(dialog);
        const folderName = (id) => folders.find((f) => f.id === id)?.name ?? 'Inbox';
        function options() {
            const q = query.trim().toLowerCase();
            const rank = (f) => {
                if (f.id === INBOX_ID)
                    return 10_000; // Inbox has its own button; list it last
                const r = recent.indexOf(f.id);
                return r === -1 ? 1_000 : r;
            };
            const sorted = [...folders].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
            const result = sorted
                .filter((f) => f.name.toLowerCase().includes(q))
                .map((folder) => ({ kind: 'folder', folder }));
            if (q && !folders.some((f) => f.name.toLowerCase() === q)) {
                result.push({ kind: 'create', name: query.trim() });
            }
            return result;
        }
        function drawList() {
            const opts = options();
            active = Math.min(active, Math.max(0, opts.length - 1));
            list.replaceChildren();
            opts.forEach((opt, i) => {
                const item = el('li', 'folder-option');
                item.id = `folder-option-${i}`;
                item.setAttribute('role', 'option');
                if (opt.kind === 'create') {
                    item.classList.add('folder-option-create');
                    item.append(withIcon(el('span', 'folder-option-plus'), 'plus', 14), el('span', 'folder-option-name', `Create folder “${opt.name}”`));
                }
                else {
                    const dot = el('span', 'folder-dot');
                    dot.style.setProperty('--folder-color', opt.folder.color);
                    item.append(dot, el('span', 'folder-option-name', opt.folder.name));
                    if (opt.folder.id === originalFolder)
                        item.appendChild(el('span', 'folder-option-hint', 'current'));
                    if (opt.folder.id === selected) {
                        item.setAttribute('aria-selected', 'true');
                        item.appendChild(withIcon(el('span', 'folder-option-check'), 'check', 16));
                    }
                }
                if ((query || navigated) && i === active) {
                    item.classList.add('is-active');
                    filter.setAttribute('aria-activedescendant', item.id);
                }
                item.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the filter
                item.addEventListener('click', () => pick(opt));
                list.appendChild(item);
            });
            list.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
            if (!(query || navigated))
                filter.removeAttribute('aria-activedescendant');
        }
        async function pick(opt) {
            if (filter.disabled)
                return;
            if (opt.kind === 'create') {
                filter.disabled = true;
                folders = visibleFolders(await window.api.addFolder(opt.name, ''));
                filter.disabled = false;
                const created = [...folders].reverse().find((f) => f.name === opt.name);
                if (created)
                    selected = created.id;
            }
            else {
                selected = opt.folder.id;
            }
            query = '';
            filter.value = '';
            navigated = false;
            drawList();
            updateFooter();
            filter.focus();
        }
        function updateFooter() {
            const name = folderName(selected);
            if (originalFolder !== null) {
                confirmButton.textContent = selected === originalFolder ? 'Done' : `Move to ${name}`;
            }
            else {
                confirmButton.textContent = `Save to ${name}`;
            }
            keepButton.hidden = selected === INBOX_ID || originalFolder !== null;
            if (saveResult && !saveResult.ok) {
                confirmButton.textContent = 'Try again';
                keepButton.hidden = true;
            }
        }
        // ----- Preview states -----
        function showSkeleton() {
            preview.className = 'save-preview is-loading';
            const sk = el('div', 'skeleton');
            sk.append(el('div', 'sk-avatar'), el('div', 'sk-line sk-short'), el('div', 'sk-line'), el('div', 'sk-line sk-mid'));
            preview.replaceChildren(sk);
            status.textContent = 'Saving post and media…';
        }
        function showPreview(post) {
            preview.className = 'save-preview';
            const card = el('div', 'preview-card');
            card.appendChild(tweetHeader(post, 'sm'));
            if (post.text)
                card.appendChild(el('p', 'preview-text', post.text.replace(/\n\s*\n+/g, '\n')));
            const firstPhoto = post.media.find((m) => m.type === 'photo' && m.fileUrl);
            if (firstPhoto?.fileUrl) {
                const img = el('img', 'preview-media');
                img.src = firstPhoto.fileUrl;
                img.alt = '';
                card.appendChild(img);
            }
            const badges = mediaBadges(post.media.map((m) => m.type));
            if (badges)
                card.appendChild(badges);
            preview.replaceChildren(card);
        }
        // Nothing to file after a failed save, so the folder controls are switched off.
        function setFilingEnabled(enabled) {
            filter.disabled = !enabled;
            noteInput.disabled = !enabled;
            list.classList.toggle('is-disabled', !enabled);
            list.setAttribute('aria-disabled', String(!enabled));
        }
        function showFailure(message) {
            preview.className = 'save-preview is-error';
            preview.replaceChildren(el('p', 'preview-error-title', 'Couldn’t save this post'), el('p', 'preview-error-body', message));
            status.textContent = '';
            setFilingEnabled(false);
            confirmButton.focus(); // Enter = Try again
        }
        // ----- Saving -----
        function startSave() {
            const retrying = saveResult !== null;
            saveResult = null;
            setFilingEnabled(true);
            if (retrying)
                filter.focus();
            showSkeleton();
            updateFooter();
            savePromise = window.api
                .saveLink(url)
                .catch(() => ({ ok: false, message: 'Unexpected error while saving.' }));
            savePromise.then(async (result) => {
                saveResult = result;
                if (closed) {
                    // Dismissed while saving: the post simply lands in Inbox (or stays where it was).
                    if (result.ok && !result.alreadySaved) {
                        showToast('Saved to Inbox', false, true, {
                            label: 'View',
                            run: () => (location.hash = postHref(result.tweetId)),
                        });
                    }
                    else if (!result.ok) {
                        showToast(result.message, true);
                    }
                    render();
                    return;
                }
                if (!result.ok || !result.tweetId) {
                    showFailure(result.message);
                    updateFooter();
                    return;
                }
                const post = await window.api.getPost(result.tweetId);
                if (closed)
                    return;
                if (post)
                    showPreview(post);
                status.textContent = result.message === 'Saved.' ? '' : result.message;
                if (result.alreadySaved && post) {
                    title.textContent = 'Already saved';
                    originalFolder = post.folderId;
                    selected = post.folderId;
                    if (!noteInput.value)
                        noteInput.value = post.note;
                    status.textContent = `In ${folderName(post.folderId)}`;
                    drawList();
                }
                updateFooter();
            });
        }
        async function commit(folderId) {
            if (committing)
                return;
            if (saveResult && !saveResult.ok) {
                startSave(); // "Try again"
                return;
            }
            committing = true;
            confirmButton.disabled = true;
            keepButton.disabled = true;
            if (!saveResult)
                confirmButton.textContent = 'Finishing…';
            const result = await savePromise;
            if (!result.ok || !result.tweetId) {
                committing = false;
                confirmButton.disabled = false;
                keepButton.disabled = false;
                return; // the failure state is already showing
            }
            await window.api.savePostMeta(result.tweetId, { folderId, note: noteInput.value.trim() });
            rememberFolder(folderId);
            close(false);
            const name = folderName(folderId);
            const message = originalFolder === null
                ? `Saved to ${name}`
                : folderId === originalFolder
                    ? `Kept in ${name}`
                    : `Moved to ${name}`;
            showToast(message, false, true, { label: 'View', run: () => (location.hash = postHref(result.tweetId)) });
            render();
        }
        function close(dismissed) {
            if (closed)
                return;
            closed = true;
            dialogOpen = false;
            dialog.close();
            dialog.remove();
            if (dismissed && saveResult?.ok && !saveResult.alreadySaved) {
                showToast('Saved to Inbox', false, true, {
                    label: 'View',
                    run: () => (location.hash = postHref(saveResult.tweetId)),
                });
                render();
            }
        }
        // ----- Events -----
        filter.addEventListener('input', () => {
            query = filter.value;
            active = 0;
            navigated = false;
            drawList();
        });
        filter.addEventListener('keydown', (e) => {
            const count = options().length;
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (!navigated && !query) {
                    // start from the selected folder
                    active = Math.max(0, options().findIndex((o) => o.kind === 'folder' && o.folder.id === selected));
                }
                navigated = true;
                active = (active + (e.key === 'ArrowDown' ? 1 : -1) + count) % count;
                drawList();
            }
            else if (e.key === 'Enter') {
                e.preventDefault();
                if (query || navigated) {
                    const opt = options()[active];
                    if (opt)
                        pick(opt);
                }
                else {
                    commit(selected);
                }
            }
        });
        noteInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                commit(selected);
            }
        });
        confirmButton.addEventListener('click', () => commit(selected));
        keepButton.addEventListener('click', () => commit(INBOX_ID));
        closeButton.addEventListener('click', () => close(true));
        // Esc: first clears the search, then closes. Handled on keydown because
        // Chromium may ignore preventDefault() on the dialog's own 'cancel' event.
        dialog.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape')
                return;
            e.preventDefault();
            if (query) {
                query = '';
                filter.value = '';
                navigated = false;
                drawList();
            }
            else {
                close(true);
            }
        });
        // Safety net: however the dialog ends up closed, clean up exactly once.
        dialog.addEventListener('close', () => close(true));
        // Click on the backdrop (outside the panel) dismisses.
        dialog.addEventListener('mousedown', (e) => {
            if (e.target === dialog)
                close(true);
        });
        drawList();
        startSave();
        dialog.showModal();
        filter.focus();
    }
    saveForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const url = linkInput.value.trim();
        if (!url) {
            linkInput.focus();
            return;
        }
        if (!looksLikeTweetLink(url)) {
            showToast('That doesn’t look like a tweet link. Copy the link from the post’s Share menu on X.', true);
            linkInput.select();
            return;
        }
        linkInput.value = '';
        linkInput.blur();
        openSaveDialog(url);
    });
    // Ctrl+V anywhere (outside a text field) with a tweet link starts a save.
    document.addEventListener('paste', (event) => {
        if (dialogOpen)
            return;
        if (event.target.closest('input, textarea, [contenteditable]'))
            return;
        const text = event.clipboardData?.getData('text') ?? '';
        if (looksLikeTweetLink(text)) {
            event.preventDefault();
            openSaveDialog(text.trim());
        }
    });
    let panel = null;
    const gridOrder = () => [...view.querySelectorAll('a.post-link')].map((a) => decodeURIComponent((a.getAttribute('href') ?? '').split('/').pop() ?? ''));
    function markCurrentCard() {
        view.querySelectorAll('.post-card.is-current').forEach((c) => c.classList.remove('is-current'));
        if (!panel)
            return;
        const card = view.querySelector(`a.post-link[href="${postHref(panel.postId)}"]`)?.closest('.post-card');
        card?.classList.add('is-current');
        card?.scrollIntoView({ block: 'nearest' });
    }
    function createPanel(postId, cameFromGrid) {
        const dialog = el('dialog', 'panel');
        dialog.setAttribute('aria-label', 'Post');
        const head = el('div', 'panel-head');
        const prev = withIcon(el('button', 'icon-button'), 'arrow-left', 18);
        prev.type = 'button';
        prev.setAttribute('aria-label', 'Previous post');
        prev.title = 'Previous post (←)';
        const next = withIcon(el('button', 'icon-button'), 'arrow-right', 18);
        next.type = 'button';
        next.setAttribute('aria-label', 'Next post');
        next.title = 'Next post (→)';
        const counter = el('span', 'panel-counter');
        const close = withIcon(el('button', 'icon-button'), 'x');
        close.type = 'button';
        close.setAttribute('aria-label', 'Close');
        close.title = 'Close (Esc)';
        head.append(prev, next, counter, el('span', 'panel-spacer'), close);
        const scroller = el('div', 'panel-body');
        scroller.tabIndex = -1; // focus target, so arrow keys work right away
        dialog.append(head, scroller);
        document.body.appendChild(dialog);
        prev.addEventListener('click', () => stepPanel(-1));
        next.addEventListener('click', () => stepPanel(1));
        close.addEventListener('click', leavePanel);
        dialog.addEventListener('cancel', (e) => {
            e.preventDefault();
            leavePanel();
        });
        dialog.addEventListener('mousedown', (e) => {
            if (e.target === dialog)
                leavePanel(); // backdrop
        });
        dialog.showModal();
        return { dialog, scroller, prev, next, counter, order: gridOrder(), postId, cameFromGrid };
    }
    async function showPanel(post, cameFrom) {
        const folders = visibleFolders(await window.api.listFolders());
        if (!panel) {
            const fromGrid = cameFrom?.name === 'folder' && baseKey === `folder:${cameFrom.id}`;
            panel = createPanel(post.id, fromGrid);
        }
        panel.postId = post.id;
        panel.scroller.replaceChildren(detailContent(post, folders));
        panel.scroller.scrollTop = 0;
        panel.scroller.focus({ preventScroll: true });
        updatePanelNav();
    }
    // Counter and ←/→ state; call again whenever panel.order changes.
    function updatePanelNav() {
        if (!panel)
            return;
        const index = panel.order.indexOf(panel.postId);
        panel.prev.disabled = index <= 0;
        panel.next.disabled = index === -1 || index >= panel.order.length - 1;
        panel.counter.textContent = index === -1 ? '' : `${index + 1} of ${panel.order.length}`;
        markCurrentCard();
    }
    function stepPanel(delta) {
        if (!panel)
            return;
        const index = panel.order.indexOf(panel.postId);
        const target = index === -1 ? undefined : panel.order[index + delta];
        // replace: stepping through posts shouldn't fill up Back history
        if (target)
            location.replace(postHref(target));
    }
    function leavePanel() {
        if (!panel)
            return;
        if (panel.cameFromGrid)
            history.back();
        else
            location.hash = baseKey.startsWith('folder:') ? folderHref(baseKey.slice('folder:'.length)) : '#/';
    }
    function closePanel() {
        if (!panel)
            return;
        const { dialog } = panel;
        panel = null;
        closeLightbox();
        dialog.close();
        dialog.remove();
        markCurrentCard();
    }
    let lightbox = null;
    function openLightbox(urls, index) {
        if (lightbox || urls.length === 0)
            return;
        const dialog = el('dialog', 'lightbox');
        dialog.setAttribute('aria-label', 'Photo viewer');
        const img = el('img', 'lightbox-img');
        img.alt = '';
        const counter = el('span', 'lightbox-counter');
        const close = withIcon(el('button', 'lightbox-button lightbox-close'), 'x', 20);
        close.type = 'button';
        close.setAttribute('aria-label', 'Close photo');
        dialog.append(img, counter, close);
        if (urls.length > 1) {
            const prev = withIcon(el('button', 'lightbox-button lightbox-prev'), 'arrow-left', 20);
            prev.type = 'button';
            prev.setAttribute('aria-label', 'Previous photo');
            prev.addEventListener('click', () => stepLightbox(-1));
            const next = withIcon(el('button', 'lightbox-button lightbox-next'), 'arrow-right', 20);
            next.type = 'button';
            next.setAttribute('aria-label', 'Next photo');
            next.addEventListener('click', () => stepLightbox(1));
            dialog.append(prev, next);
        }
        close.addEventListener('click', closeLightbox);
        dialog.addEventListener('cancel', (e) => {
            e.preventDefault();
            closeLightbox();
        });
        // Clicking anywhere except the photo or a button closes it.
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog)
                closeLightbox();
        });
        document.body.appendChild(dialog);
        lightbox = { dialog, img, counter, urls, index };
        stepLightbox(0);
        dialog.showModal();
        close.focus();
    }
    function stepLightbox(delta) {
        if (!lightbox)
            return;
        const { urls } = lightbox;
        lightbox.index = (lightbox.index + delta + urls.length) % urls.length;
        lightbox.img.src = urls[lightbox.index];
        lightbox.counter.textContent = urls.length > 1 ? `${lightbox.index + 1} / ${urls.length}` : '';
    }
    function closeLightbox() {
        if (!lightbox)
            return;
        const { dialog } = lightbox;
        lightbox = null;
        dialog.close();
        dialog.remove();
        panel?.scroller.focus({ preventScroll: true });
    }
    // ---------- Keyboard ----------
    document.addEventListener('keydown', (event) => {
        if (dialogOpen)
            return; // save / folder dialogs handle their own keys
        const target = event.target;
        const typing = target.closest('input, textarea, select, video, [contenteditable]');
        const key = event.key;
        if (lightbox) {
            if (key === 'Escape')
                closeLightbox();
            else if (key === 'ArrowLeft')
                stepLightbox(-1);
            else if (key === 'ArrowRight')
                stepLightbox(1);
            else
                return;
            event.preventDefault();
            return;
        }
        if (panel) {
            if (key === 'Escape') {
                event.preventDefault();
                if (typing)
                    target.blur(); // first Esc leaves the field, second closes
                else
                    leavePanel();
            }
            else if (!typing && (key === 'ArrowLeft' || key === 'ArrowRight')) {
                event.preventDefault();
                stepPanel(key === 'ArrowLeft' ? -1 : 1);
            }
            else if (!typing && key === 'Delete' && !event.repeat) {
                event.preventDefault();
                const handle = panel.scroller.querySelector('.detail-main .post-handle')?.textContent?.replace(/^@/, '') ?? '';
                deletePostWithUndo({ id: panel.postId, authorHandle: handle });
            }
            return;
        }
        if (key === 'Escape' && !typing && currentRoute().name === 'folder') {
            location.hash = '#/';
        }
    });
    window.addEventListener('hashchange', () => render());
    render();
})();
