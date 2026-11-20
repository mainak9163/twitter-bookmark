"use strict";
(() => {
    const linkInput = document.getElementById('link-input');
    const saveButton = document.getElementById('save-button');
    const statusText = document.getElementById('status-text');
    const postList = document.getElementById('post-list');
    const folderName = document.getElementById('folder-name');
    const folderDesc = document.getElementById('folder-desc');
    const addFolderButton = document.getElementById('add-folder-button');
    const folderList = document.getElementById('folder-list');
    const searchInput = document.getElementById('search-input');
    const filterFolder = document.getElementById('filter-folder');
    let allPosts = [];
    let folders = [];
    function renderFilterOptions() {
        const current = filterFolder.value;
        filterFolder.replaceChildren();
        filterFolder.appendChild(new Option('All folders', ''));
        filterFolder.appendChild(new Option('No folder', 'none'));
        for (const folder of folders) {
            filterFolder.appendChild(new Option(folder.name, folder.id));
        }
        filterFolder.value = current;
    }
    function renderFolders() {
        folderList.replaceChildren();
        for (const folder of folders) {
            const item = document.createElement('li');
            item.textContent = folder.description
                ? `${folder.name} — ${folder.description}`
                : folder.name;
            folderList.appendChild(item);
        }
        renderFilterOptions();
    }
    function buildCard(post) {
        const card = document.createElement('div');
        card.style.cssText = 'border:1px solid #ccc; margin:12px 0; padding:8px; display:flex; gap:12px;';
        if (post.screenshotUrl) {
            const img = document.createElement('img');
            img.src = post.screenshotUrl;
            img.style.cssText = 'width:200px; align-self:flex-start;';
            card.appendChild(img);
        }
        const info = document.createElement('div');
        const author = document.createElement('strong');
        author.textContent = '@' + post.authorHandle;
        const text = document.createElement('p');
        text.style.whiteSpace = 'pre-wrap';
        text.textContent = post.text.slice(0, 200);
        const select = document.createElement('select');
        select.appendChild(new Option('No folder', ''));
        for (const folder of folders) {
            const option = new Option(folder.name, folder.id);
            option.title = folder.description;
            select.appendChild(option);
        }
        select.value = post.folderId ?? '';
        const noteInput = document.createElement('input');
        noteInput.type = 'text';
        noteInput.size = 50;
        noteInput.placeholder = 'Why did you save this?';
        noteInput.value = post.note;
        const saveDetails = document.createElement('button');
        saveDetails.textContent = 'Save details';
        const detailsStatus = document.createElement('span');
        saveDetails.addEventListener('click', async () => {
            await window.api.savePostMeta(post.id, {
                folderId: select.value || null,
                note: noteInput.value.trim(),
            });
            post.folderId = select.value || null;
            post.note = noteInput.value.trim();
            detailsStatus.textContent = ' Saved';
        });
        info.append(author, text, select, ' ', noteInput, ' ', saveDetails, detailsStatus);
        card.appendChild(info);
        return card;
    }
    function showPosts() {
        const query = searchInput.value.trim().toLowerCase();
        const folderId = filterFolder.value;
        postList.replaceChildren();
        for (const post of allPosts) {
            if (folderId === 'none' && post.folderId !== null)
                continue;
            if (folderId && folderId !== 'none' && post.folderId !== folderId)
                continue;
            const haystack = `${post.text} ${post.authorHandle} ${post.note}`.toLowerCase();
            if (query && !haystack.includes(query))
                continue;
            postList.appendChild(buildCard(post));
        }
    }
    async function renderPosts() {
        allPosts = await window.api.listPosts();
        showPosts();
    }
    saveButton.addEventListener('click', async () => {
        const url = linkInput.value.trim();
        if (!url) {
            statusText.textContent = 'Paste a link first.';
            return;
        }
        statusText.textContent = 'Saving...';
        const result = await window.api.saveLink(url);
        statusText.textContent = result.message;
        if (result.ok) {
            linkInput.value = '';
            await renderPosts();
        }
    });
    addFolderButton.addEventListener('click', async () => {
        const name = folderName.value.trim();
        if (!name) {
            return;
        }
        folders = await window.api.addFolder(name, folderDesc.value.trim());
        folderName.value = '';
        folderDesc.value = '';
        renderFolders();
        await renderPosts(); // refresh so every dropdown has the new folder
    });
    async function start() {
        folders = await window.api.listFolders();
        renderFolders();
        await renderPosts();
    }
    searchInput.addEventListener('input', showPosts);
    filterFolder.addEventListener('change', showPosts);
    start();
})();
