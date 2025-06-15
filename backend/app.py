from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
from tkinter import Tk, filedialog
import threading

import renamer_core
import cleaner_core

app = Flask(__name__, static_folder='../frontend')
CORS(app) # Allow cross-origin requests

# A simple cache to hold the list of video files for a given folder path
# In a real multi-user app, this would need a more robust solution (e.g., Redis, session storage)
file_cache = {}
PAGE_SIZE = 20

# --- FOLDER DIALOG HELPER ---
def open_folder_dialog():
    root = Tk()
    root.withdraw() # Hide the main window
    root.attributes('-topmost', True) # Bring the dialog to the front
    folder = filedialog.askdirectory(title="Select Folder with Movies")
    root.destroy()
    return folder

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

def get_suggestions_for_files(files):
    """Helper function to fetch suggestions for a list of file paths."""
    suggestions = []
    for filepath in files:
        filename = os.path.basename(filepath)
        guesses, year = renamer_core.generate_title_guesses(filename)
        suggestion = renamer_core.fetch_title_from_omdb(guesses, year)
        suggestions.append({
            "filepath": os.path.normpath(filepath), # Ensure consistent path format
            "original": filename,
            "suggestion": suggestion or "N/A"
        })
    return suggestions

@app.route('/api/select-folder', methods=['POST'])
def select_folder():
    folder_path = open_folder_dialog()
    if not folder_path:
        return jsonify({"error": "No folder selected"}), 400

    folder_path = os.path.normpath(folder_path)
    video_files = renamer_core.get_video_files(folder_path)

    if not video_files:
        return jsonify({"suggestions": [], "folderPath": folder_path, "totalPages": 0})

    # Cache the full list of files
    file_cache[folder_path] = video_files

    # Calculate total pages
    total_pages = (len(video_files) + PAGE_SIZE - 1) // PAGE_SIZE

    # Get suggestions for the first page only
    first_page_files = video_files[:PAGE_SIZE]
    suggestions = get_suggestions_for_files(first_page_files)

    return jsonify({
        "suggestions": suggestions,
        "folderPath": folder_path,
        "totalPages": total_pages
    })

@app.route('/api/get-page', methods=['POST'])
def get_page():
    data = request.json
    folder_path = data.get('folderPath')
    page = data.get('page', 1)

    if not folder_path or folder_path not in file_cache:
        return jsonify({"error": "Invalid folder path or cache expired."}), 400

    video_files = file_cache[folder_path]
    
    # Calculate the slice for the requested page
    start_index = (page - 1) * PAGE_SIZE
    end_index = start_index + PAGE_SIZE
    page_files = video_files[start_index:end_index]

    suggestions = get_suggestions_for_files(page_files)

    return jsonify({"suggestions": suggestions})

@app.route('/api/rename', methods=['POST'])
def rename_endpoint():
    data = request.json
    if not data or 'files' not in data:
        return jsonify({"error": "Invalid data"}), 400
    
    result = renamer_core.rename_files(data['files'])
    return jsonify(result)

@app.route('/api/cleanup-scan', methods=['POST'])
def cleanup_scan():
    data = request.json
    folder_path = data.get('folderPath')
    if not folder_path or not os.path.isdir(folder_path):
        return jsonify({"error": "Invalid folder path"}), 400
    
    large_files = cleaner_core.get_large_files(folder_path)
    small_dirs = cleaner_core.get_small_dirs(folder_path)
    
    return jsonify({
        "largeFiles": large_files,
        "smallDirs": small_dirs
    })

@app.route('/api/move-files', methods=['POST'])
def move_files():
    data = request.json
    files_to_move = data.get('files', [])
    root_dir = data.get('folderPath')
    if not files_to_move or not root_dir:
        return jsonify({"error": "Invalid data"}), 400
    
    result = cleaner_core.move_files_to_root(files_to_move, root_dir)
    return jsonify(result)

@app.route('/api/delete-folders', methods=['POST'])
def delete_folders():
    data = request.json
    folders_to_delete = data.get('folders', [])
    if not folders_to_delete:
        return jsonify({"error": "Invalid data"}), 400
        
    result = cleaner_core.delete_folders(folders_to_delete)
    return jsonify(result)

if __name__ == '__main__':
    print("Starting Flask server...")
    print("Open http://127.0.0.1:5000 in your browser.")
    app.run(debug=True, port=5000)
