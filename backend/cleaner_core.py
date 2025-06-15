import os
import shutil
from send2trash import send2trash
import logging

# Logging configuration
logging.basicConfig(filename='file_mover.log', level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')

FILE_SIZE_LIMIT_MB = 500

def get_large_files(root_dir):
    large_files = []
    for subdir, _, files in os.walk(root_dir):
        if os.path.abspath(subdir) == os.path.abspath(root_dir):
            continue  # Skip the root directory itself
        for file in files:
            path = os.path.join(subdir, file)
            try:
                size_mb = os.path.getsize(path) / (1024 * 1024)
                if size_mb > FILE_SIZE_LIMIT_MB:
                    large_files.append({
                        "name": file,
                        "path": path,
                        "size_mb": round(size_mb, 2)
                    })
            except Exception as e:
                logging.warning(f"Error reading file {path}: {e}")
    large_files.sort(key=lambda x: x['name'].lower())
    return large_files

def get_small_dirs(root_dir):
    small_dirs = []
    for name in os.listdir(root_dir):
        full_path = os.path.join(root_dir, name)
        if os.path.isdir(full_path):
            try:
                total_size = 0
                for dirpath, _, filenames in os.walk(full_path):
                    for f in filenames:
                        fp = os.path.join(dirpath, f)
                        total_size += os.path.getsize(fp)
                size_mb = total_size / (1024 * 1024)
                if size_mb <= FILE_SIZE_LIMIT_MB:
                    small_dirs.append({
                        "name": name,
                        "path": full_path,
                        "size_mb": round(size_mb, 2)
                    })
            except Exception as e:
                logging.warning(f"Error scanning directory {full_path}: {e}")
    small_dirs.sort(key=lambda x: x['name'].lower())
    return small_dirs

def move_files_to_root(files_to_move, root_dir):
    moved = []
    failed = []
    for path in files_to_move:
        try:
            norm_path = os.path.normpath(path)
            norm_root_dir = os.path.normpath(root_dir)
            dest = os.path.join(norm_root_dir, os.path.basename(norm_path))
            shutil.move(norm_path, dest)
            moved.append(os.path.basename(norm_path))
            logging.info(f"Moved: {norm_path} to {dest}")
        except Exception as e:
            failed.append(f"{os.path.basename(path)}: {e}")
            logging.error(f"Failed to move {path}: {e}")
    return {"moved": moved, "failed": failed}

def delete_folders(folders_to_delete):
    deleted = []
    failed = []
    for path in folders_to_delete:
        try:
            norm_path = os.path.normpath(path)
            send2trash(norm_path)
            deleted.append(os.path.basename(norm_path))
            logging.info(f"Sent to Recycle Bin: {norm_path}")
        except Exception as e:
            failed.append(f"{os.path.basename(path)}: {e}")
            logging.error(f"Failed to delete {path}: {e}")
    return {"deleted": deleted, "failed": failed}
