from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
from tkinter import Tk, filedialog
import threading

import renamer_core

app = Flask(__name__, static_folder='../frontend')
CORS(app) # Allow cross-origin requests

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

@app.route('/api/select-folder', methods=['POST'])
def select_folder():
    folder_path = open_folder_dialog()
    if not folder_path:
        return jsonify({"error": "No folder selected"}), 400

    video_files = renamer_core.get_video_files(folder_path)
    file_suggestions = []

    for filepath in video_files:
        filename = os.path.basename(filepath)
        guesses, year = renamer_core.generate_title_guesses(filename)
        suggestion = renamer_core.fetch_title_from_omdb(guesses, year)
        file_suggestions.append({
            "filepath": filepath,
            "original": filename,
            "suggestion": suggestion or "N/A"
        })

    return jsonify(file_suggestions)

@app.route('/api/rename', methods=['POST'])
def rename_endpoint():
    data = request.json
    if not data or 'files' not in data:
        return jsonify({"error": "Invalid data"}), 400
    
    result = renamer_core.rename_files(data['files'])
    return jsonify(result)

if __name__ == '__main__':
    print("Starting Flask server...")
    print("Open http://127.0.0.1:5000 in your browser.")
    app.run(debug=True, port=5000)
