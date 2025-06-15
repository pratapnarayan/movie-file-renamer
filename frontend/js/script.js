document.addEventListener('DOMContentLoaded', () => {
    // --- Main UI Elements ---
    const selectFolderBtn = document.getElementById('select-folder-btn');
    const loader = document.getElementById('loader');
    const logsContainer = document.getElementById('logs-container');
    const logsOutput = document.getElementById('logs-output');

    // --- Renamer UI Elements ---
    const fileListContainer = document.getElementById('file-list-container');
    const fileListBody = document.getElementById('file-list-body');
    const renameBtn = document.getElementById('rename-btn');
    const selectAllCheckbox = document.getElementById('selectAll');
    const proceedToCleanupBtn = document.getElementById('proceed-to-cleanup-btn');
    const skipToCleanupBtn = document.getElementById('skip-to-cleanup-btn');

    // --- Cleaner UI Elements ---
    const cleanupSection = document.getElementById('cleanup-section');
    const largeFilesList = document.getElementById('large-files-list');
    const smallDirsList = document.getElementById('small-dirs-list');
    const moveFilesBtn = document.getElementById('move-files-btn');
    const deleteFoldersBtn = document.getElementById('delete-folders-btn');

    let currentFolderPath = '';
    let totalPages = 0;
    let currentPage = 1;

    // --- Event Listeners ---

    selectFolderBtn.addEventListener('click', async () => {
        resetUI();
        loader.classList.remove('d-none');
        try {
            const response = await fetch('http://127.0.0.1:5000/api/select-folder', { method: 'POST' });
            if (!response.ok) throw new Error('Failed to select folder.');
            const data = await response.json();
            currentFolderPath = data.folderPath;
            totalPages = data.totalPages;
            currentPage = 1;
            displayFiles(data.suggestions);
            renderPaginationControls();
        } catch (error) {
            handleError(error);
        } finally {
            loader.classList.add('d-none');
        }
    });

    renameBtn.addEventListener('click', async () => {
        const filesToRename = [];
        const checkedRows = fileListBody.querySelectorAll('.row-checkbox:checked');

        checkedRows.forEach(checkbox => {
            const row = checkbox.closest('tr');
            const newNameInput = row.querySelector('.new-name-input');
            const newName = newNameInput.value.trim();
            if (newName) {
                filesToRename.push({ filepath: row.dataset.filepath, newName });
            }
        });

        if (filesToRename.length === 0) {
            return alert('No files selected or new names provided for renaming.');
        }

        loader.classList.remove('d-none');
        try {
            const response = await fetch('http://127.0.0.1:5000/api/rename', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: filesToRename })
            });
            const result = await response.json();
            showLogs(`Renaming complete! Success: ${result.success}, Failed: ${result.fail}\n\n--- Details ---\n` + result.logs.join('\n'));
            proceedToCleanupBtn.classList.remove('d-none');
            // Hide the rename and skip buttons as we are now in the post-rename phase
            renameBtn.classList.add('d-none');
            skipToCleanupBtn.classList.add('d-none');
        } catch (error) {
            handleError(error, 'renaming');
        } finally {
            loader.classList.add('d-none');
        }
    });

    selectAllCheckbox.addEventListener('change', (e) => {
        fileListBody.querySelectorAll('.row-checkbox').forEach(checkbox => checkbox.checked = e.target.checked);
    });

    fileListBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('suggestion-btn')) {
            const row = e.target.closest('tr');
            const newNameInput = row.querySelector('.new-name-input');
            newNameInput.value = e.target.textContent;
            newNameInput.classList.add('is-edited');
        }
        if (e.target.classList.contains('row-checkbox')) {
            const allCheckboxes = fileListBody.querySelectorAll('.row-checkbox');
            selectAllCheckbox.checked = Array.from(allCheckboxes).every(cb => cb.checked);
        }
    });

    async function startCleanupProcess() {
        // Hide renamer UI and show cleaner UI
        fileListContainer.classList.add('d-none');
        renameBtn.classList.add('d-none');
        skipToCleanupBtn.classList.add('d-none');
        proceedToCleanupBtn.classList.add('d-none');
        cleanupSection.classList.remove('d-none');
        loader.classList.remove('d-none');

        try {
            const response = await fetch('http://127.0.0.1:5000/api/cleanup-scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderPath: currentFolderPath })
            });
            if (!response.ok) throw new Error('Cleanup scan failed.');
            const data = await response.json();
            displayCleanupItems(data.largeFiles, largeFilesList);
            displayCleanupItems(data.smallDirs, smallDirsList);
            showLogs('Cleanup scan complete. Select items to move or delete.');
        } catch (error) {
            handleError(error, 'cleanup scan');
        } finally {
            loader.classList.add('d-none');
        }
    }

    // Both "Proceed" and "Skip" buttons will trigger the cleanup scan
    proceedToCleanupBtn.addEventListener('click', startCleanupProcess);
    skipToCleanupBtn.addEventListener('click', startCleanupProcess);

    moveFilesBtn.addEventListener('click', async () => {
        const selectedFiles = getSelectedCleanupItems(largeFilesList);
        if (selectedFiles.length === 0) return alert('No files selected to move.');
        
        const response = await fetch('http://127.0.0.1:5000/api/move-files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: selectedFiles, folderPath: currentFolderPath })
        });
        const result = await response.json();
        showLogs(`Moved: ${result.moved.join(', ')}\nFailed: ${result.failed.join(', ')}`);
        proceedToCleanupBtn.click(); // Refresh cleanup view
    });

    deleteFoldersBtn.addEventListener('click', async () => {
        const selectedFolders = getSelectedCleanupItems(smallDirsList);
        if (selectedFolders.length === 0) return alert('No folders selected to delete.');

        if (!confirm(`Are you sure you want to move ${selectedFolders.length} folder(s) to the Recycle Bin?`)) return;

        const response = await fetch('http://127.0.0.1:5000/api/delete-folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folders: selectedFolders })
        });
        const result = await response.json();
        showLogs(`Deleted: ${result.deleted.join(', ')}\nFailed: ${result.failed.join(', ')}`);
        proceedToCleanupBtn.click(); // Refresh cleanup view
    });

    // --- UI Helper Functions ---

    function displayFiles(files) {
        fileListBody.innerHTML = ''; // Clear previous results
        selectAllCheckbox.checked = false;

        if (files && files.length > 0) {
            fileListContainer.classList.remove('d-none');
            const startIndex = (currentPage - 1) * 20; // PAGE_SIZE is 20 in backend
            files.forEach((file, index) => {
                const row = document.createElement('tr');
                row.dataset.filepath = file.filepath;
                const suggestedName = file.suggestion !== 'N/A' ? file.suggestion : '';

                row.innerHTML = `
                    <th scope="row">${startIndex + index + 1}</th>
                    <td class="text-center"><input class="form-check-input row-checkbox" type="checkbox"></td>
                    <td>${file.original}</td>
                    <td><button type="button" class="btn btn-link btn-sm suggestion-btn p-0">${file.suggestion}</button></td>
                    <td><input type="text" class="form-control new-name-input" value="${suggestedName}"></td>
                `;
                fileListBody.appendChild(row);

                const input = row.querySelector('.new-name-input');
                input.addEventListener('input', () => input.classList.add('is-edited'));
            });
        } else {
            // Only show alert if it's the first page and there are no files at all
            if (currentPage === 1) {
                alert('No video files found in the selected directory.');
            }
        }
    }

    function renderPaginationControls() {
        const paginationContainer = document.getElementById('pagination-container');
        const paginationControls = document.getElementById('pagination-controls');
        paginationControls.innerHTML = '';

        if (totalPages <= 1) {
            paginationContainer.classList.add('d-none');
            return;
        }

        paginationContainer.classList.remove('d-none');

        // Previous button
        const prevItem = document.createElement('li');
        prevItem.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
        prevItem.innerHTML = `<a class="page-link" href="#" data-page="${currentPage - 1}">Previous</a>`;
        paginationControls.appendChild(prevItem);

        // Page number buttons
        for (let i = 1; i <= totalPages; i++) {
            const pageItem = document.createElement('li');
            pageItem.className = `page-item ${i === currentPage ? 'active' : ''}`;
            pageItem.innerHTML = `<a class="page-link" href="#" data-page="${i}">${i}</a>`;
            paginationControls.appendChild(pageItem);
        }

        // Next button
        const nextItem = document.createElement('li');
        nextItem.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
        nextItem.innerHTML = `<a class="page-link" href="#" data-page="${currentPage + 1}">Next</a>`;
        paginationControls.appendChild(nextItem);
    }

    document.getElementById('pagination-controls').addEventListener('click', async (e) => {
        e.preventDefault();
        const target = e.target;
        if (target.tagName !== 'A' || target.parentElement.classList.contains('disabled')) {
            return; // Ignore clicks on disabled links or non-link areas
        }

        const page = parseInt(target.dataset.page, 10);
        if (page === currentPage) return;

        currentPage = page;
        loader.classList.remove('d-none');
        fileListContainer.classList.add('d-none');

        try {
            const response = await fetch('http://127.0.0.1:5000/api/get-page', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderPath: currentFolderPath, page: currentPage })
            });
            if (!response.ok) throw new Error('Failed to fetch page.');
            const data = await response.json();
            displayFiles(data.suggestions);
            renderPaginationControls(); // Re-render to update active state
        } catch (error) {
            handleError(error, 'fetching page');
        } finally {
            loader.classList.add('d-none');
        }
    });

    function displayCleanupItems(items, listElement) {
        listElement.innerHTML = '';
        items.forEach(item => {
            const listItem = document.createElement('label');
            listItem.className = 'list-group-item';
            listItem.innerHTML = `
                <input class="form-check-input me-2" type="checkbox" value="${item.path}">
                ${item.name} <span class="text-muted">(${item.size_mb} MB)</span>
            `;
            listElement.appendChild(listItem);
        });
    }

    function getSelectedCleanupItems(listElement) {
        return Array.from(listElement.querySelectorAll('input:checked')).map(cb => cb.value);
    }

    function showLogs(message) {
        logsContainer.classList.remove('d-none');
        logsOutput.textContent = message;
    }

    function handleError(error, context = 'operation') {
        console.error(`Error during ${context}:`, error);
        alert(`An error occurred during ${context}. Check the console.`);
    }

    function resetUI() {
        fileListContainer.classList.add('d-none');
        cleanupSection.classList.add('d-none');
        logsContainer.classList.add('d-none');
        proceedToCleanupBtn.classList.add('d-none');
        renameBtn.classList.remove('d-none');
        skipToCleanupBtn.classList.remove('d-none');
        fileListBody.innerHTML = '';
        largeFilesList.innerHTML = '';
        smallDirsList.innerHTML = '';
        currentFolderPath = '';
        selectAllCheckbox.checked = false;
        totalPages = 0;
        currentPage = 1;
        document.getElementById('pagination-container').classList.add('d-none');
    }
});
