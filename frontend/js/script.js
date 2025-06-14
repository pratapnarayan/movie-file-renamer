document.addEventListener('DOMContentLoaded', () => {
    const selectFolderBtn = document.getElementById('select-folder-btn');
    const renameBtn = document.getElementById('rename-btn');
    const fileListBody = document.getElementById('file-list-body');
    const fileListContainer = document.getElementById('file-list-container');
    const loader = document.getElementById('loader');
    const logsContainer = document.getElementById('logs-container');
    const logsOutput = document.getElementById('logs-output');
    const selectAllCheckbox = document.getElementById('selectAll');

    let fileData = [];

    selectFolderBtn.addEventListener('click', async () => {
        loader.classList.remove('d-none');
        fileListContainer.classList.add('d-none');
        logsContainer.classList.add('d-none');
        fileListBody.innerHTML = '';
        selectAllCheckbox.checked = false;

        try {
            const response = await fetch('http://127.0.0.1:5000/api/select-folder', { method: 'POST' });
            if (!response.ok) throw new Error('Failed to select folder or fetch data.');
            fileData = await response.json();
            displayFiles(fileData);
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred. Check the console for details.');
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
                filesToRename.push({
                    filepath: row.dataset.filepath,
                    newName: newName
                });
            }
        });

        if (filesToRename.length === 0) {
            alert('No files selected or new names provided for renaming.');
            return;
        }

        loader.classList.remove('d-none');

        try {
            const response = await fetch('http://127.0.0.1:5000/api/rename', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: filesToRename })
            });
            const result = await response.json();
            logsOutput.textContent = result.logs.join('\n');
            logsContainer.classList.remove('d-none');
            alert(`Renaming complete! Success: ${result.success}, Failed: ${result.fail}`);
            selectFolderBtn.click(); // Refresh the list
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred during renaming.');
        } finally {
            loader.classList.add('d-none');
        }
    });

    selectAllCheckbox.addEventListener('change', (e) => {
        const checkboxes = fileListBody.querySelectorAll('.row-checkbox');
        checkboxes.forEach(checkbox => checkbox.checked = e.target.checked);
    });

    fileListBody.addEventListener('click', (e) => {
        // Handle suggestion button clicks
        if (e.target.classList.contains('suggestion-btn')) {
            const row = e.target.closest('tr');
            const newNameInput = row.querySelector('.new-name-input');
            newNameInput.value = e.target.textContent;
            newNameInput.classList.add('is-edited');
        }

        // Handle row checkbox changes
        if (e.target.classList.contains('row-checkbox')) {
            const allCheckboxes = fileListBody.querySelectorAll('.row-checkbox');
            const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);
            selectAllCheckbox.checked = allChecked;
        }
    });

    function displayFiles(files) {
        fileListBody.innerHTML = '';
        if (files.length > 0) {
            fileListContainer.classList.remove('d-none');
            files.forEach((file, index) => {
                const row = document.createElement('tr');
                row.dataset.filepath = file.filepath;
                const suggestedName = file.suggestion !== 'N/A' ? file.suggestion : '';

                row.innerHTML = `
                    <th scope="row">${index + 1}</th>
                    <td class="text-center"><input class="form-check-input row-checkbox" type="checkbox"></td>
                    <td>${file.original}</td>
                    <td><button type="button" class="btn btn-link btn-sm suggestion-btn p-0">${file.suggestion}</button></td>
                    <td><input type="text" class="form-control new-name-input" value="${suggestedName}"></td>
                `;
                fileListBody.appendChild(row);

                const input = row.querySelector('.new-name-input');
                input.addEventListener('input', () => {
                    input.classList.add('is-edited');
                });
            });
        } else {
            alert('No video files found in the selected directory.');
        }
    }
});
