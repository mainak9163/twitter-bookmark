"use strict";
(() => {
    const linkInput = document.getElementById('link-input');
    const saveButton = document.getElementById('save-button');
    const toast = document.getElementById('toast');
    const postList = document.getElementById('post-list');
    const folderName = document.getElementById('folder-name');
    const folderDesc = document.getElementById('folder-desc');
    const addFolderButton = document.getElementById('add-folder-button');
    const folderList = document.getElementById('folder-list');
    const searchInput = document.getElementById('search-input');
    const filterFolder = document.getElementById('filter-folder');
    let folders = [];
    let allPosts = [];
    let toastTimer;
    function showToast(message, isError = false, autoHide = true) {
        toast.textContent = message;
        toast.className = isError ? 'toast toast-error' : 'toast';
        toast.hidden = false;
        window.clearTimeout(toastTimer);
        if (autoHide) {
            toastTimer = window.setTimeout(() => {
                toast.hidden = true;
            }, 4000);
        }
    }
    function renderFilterOptions() {
        const current = filterFolder.value;
        filterFolder.replaceChildren();
        filterFolder.appendChild(new Option('All folders', ''));
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
        card.className = 'post-card';
        if (post.screenshotUrl) {
            const img = document.createElement('img');
            img.src = post.screenshotUrl;
            img.className = 'post-shot';
            card.appendChild(img);
        }
        const info = document.createElement('div');
        info.className = 'post-info';
        const author = document.createElement('strong');
        author.textContent = '@' + post.authorHandle;
        const text = document.createElement('p');
        text.style.whiteSpace = 'pre-wrap';
        text.textContent = post.text.slice(0, 200);
        const select = document.createElement('select');
        for (const folder of folders) {
            const option = new Option(folder.name, folder.id);
            option.title = folder.description;
            select.appendChild(option);
        }
        select.value = post.folderId;
        const noteInput = document.createElement('input');
        noteInput.type = 'text';
        noteInput.size = 50;
        noteInput.placeholder = 'Why did you save this?';
        noteInput.value = post.note;
        const saveDetails = document.createElement('button');
        saveDetails.className = 'btn';
        saveDetails.textContent = 'Save details';
        const detailsStatus = document.createElement('span');
        saveDetails.addEventListener('click', async () => {
            await window.api.savePostMeta(post.id, {
                folderId: select.value,
                note: noteInput.value.trim(),
            });
            post.folderId = select.value;
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
            if (folderId && post.folderId !== folderId)
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
    async function savePastedLink() {
        const url = linkInput.value.trim();
        if (!url) {
            return;
        }
        saveButton.disabled = true;
        showToast('Saving...', false, false);
        const result = await window.api.saveLink(url);
        showToast(result.message, !result.ok);
        saveButton.disabled = false;
        if (result.ok) {
            linkInput.value = '';
            await renderPosts();
        }
        linkInput.focus();
    }
    saveButton.addEventListener('click', savePastedLink);
    linkInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            savePastedLink();
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
        showPosts(); // refresh so every dropdown has the new folder
    });
    searchInput.addEventListener('input', showPosts);
    filterFolder.addEventListener('change', showPosts);
    async function start() {
        folders = await window.api.listFolders();
        renderFolders();
        await renderPosts();
    }
    start();
})();
