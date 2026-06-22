import json
import re
import os

# Path file input dan output
INPUT_FILE = 'data.js'
OUTPUT_FILE = 'video_links.json'

def extract_links():
    print(f"Membaca file {INPUT_FILE}...")
    
    try:
        with open(INPUT_FILE, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"Error: File {INPUT_FILE} tidak ditemukan di folder ini.")
        return

    # Menghapus deklarasi variabel JS agar menjadi format JSON murni
    print("Memparsing data JSON...")
    # Cari awal dari array JSON ([)
    start_idx = content.find('[')
    if start_idx == -1:
        print("Error: Format data tidak valid. Tidak bisa menemukan array JSON.")
        return
        
    json_str = content[start_idx:]
    # Hapus titik koma (;) di akhir file jika ada
    json_str = re.sub(r';\s*$', '', json_str)
    
    try:
        courses = json.loads(json_str)
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")
        return

    result = {}
    total_videos = 0

    print("Mengekstrak dan memetakan link video...")
    for course in courses:
        course_title = course.get('course_title', 'Unknown Course')
        result[course_title] = {}
        
        modules = course.get('modules', [])
        for mod_idx, module in enumerate(modules):
            module_title = module.get('module_title', f"Module {mod_idx+1}")
            result[course_title][module_title] = {}
            
            lessons = module.get('lessons', [])
            for less_idx, lesson in enumerate(lessons):
                lesson_title = lesson.get('lesson_title', f"Lesson {less_idx+1}")
                video_urls = lesson.get('video_urls', [])
                
                if video_urls:
                    # Ambil semua URL video (jika ada resolusi berbeda, biasanya terurut di array)
                    result[course_title][module_title][lesson_title] = video_urls
                    total_videos += len(video_urls)

    print(f"Selesai! Berhasil memetakan {total_videos} link video.")
    
    # Menyimpan hasil ke file JSON baru
    print(f"Menyimpan hasil ke {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=4, ensure_ascii=False)
        
    print(f"Sukses! File {OUTPUT_FILE} telah dibuat.")

if __name__ == "__main__":
    extract_links()
