document.addEventListener('DOMContentLoaded', () => {
    const selectFolderBtn = document.getElementById('select-folder-btn');
    const renameBtn = document.getElementById('rename-btn');
    const fileListBody = document.getElementById('file-list-body');
    const fileListContainer = document.getElementById('file-list-container');
    const loader = document.getElementById('loader');
    const logsContainer = document.getElementById('logs-container');
    const logsOutput = document.getElementById('logs-output');

    let fileData = [];

    selectFolderBtn.addEventListener('click', async () => {
        loader.classList.remove('d-none');
        fileListContainer.classList.add('d-none');
        logsContainer.classList.add('d-none');
        fileListBody.innerHTML = '';

        try {
            const response = await fetch('http://127.0.0.1:5000/api/select-folder', { method: 'POST' });
            if (!response.ok) {
                throw new Error('Failed to select folder or fetch data.');
            }
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
        const rows = fileListBody.querySelectorAll('tr');
        rows.forEach(row => {
            const newName = row.querySelector('input').value.trim();
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
            // Refresh file list
            selectFolderBtn.click();
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred during renaming.');
        } finally {
            loader.classList.add('d-none');
        }
    });

    function displayFiles(files) {
        fileListBody.innerHTML = '';
        if (files.length > 0) {
            fileListContainer.classList.remove('d-none');
            files.forEach((file, index) => {
                const row = document.createElement('tr');
                row.dataset.filepath = file.filepath;

                row.innerHTML = `
                    <th scope="row">${index + 1}</th>
                    <td>${file.original}</td>
                    <td>${file.suggestion}</td>
                    <td><input type="text" class="form-control" value="${file.suggestion !== 'N/A' ? file.suggestion : ''}"></td>
                `;
                fileListBody.appendChild(row);

                const input = row.querySelector('input');
                input.addEventListener('input', () => {
                    input.classList.add('is-edited');
                });
            });
        } else {
            alert('No video files found in the selected directory.');
        }
    }
});
