from urllib.request import urlopen, urlretrieve
from urllib.parse import urljoin
import re, os, time

targets = [
    'https://cardscans.piwigo.com/index?/category/2249-52_faces_of_spongebob',
    # 'https://cardscans.piwigo.com/index?/category/773-8_bit_white'
    # "https://cardscans.piwigo.com/index?/search/psk-20260509-Y1EkFbYRnd",
    # "https://cardscans.piwigo.com/index?/category/2377-bicycle_disney_coco",
    # "https://cardscans.piwigo.com/index?/category/2385-bicycle_hello_kitty_50th_anniversary",
]

base = "https://cardscans.piwigo.com/"
size_priority = ["-xx.jpg", "-xl.jpg", "-la.jpg", "-me.jpg", "-sm.jpg", "-xs.jpg", "-2s.jpg"]

def slugify(text: str) -> str:
    text = text.strip().replace("/", "-")
    text = re.sub(r"[^A-Za-z0-9._ -]+", "_", text)
    return text[:180] or "deck"

def extract_title(html: str) -> str | None:
    match = re.search(r"<title>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    if not match:
        return None

    title = match.group(1)
    if title is None:
        return None

    return re.sub(r"\s+", " ", title).strip()

def extract_name(url: str, html: str) -> str:
    title = extract_title(html)
    if title:
        if " | " in title:
            title = title.split(" | ")[0].strip()
        if title.lower() == "search results":
            return slugify("search-" + url.rstrip("/").split("/")[-1])
        if " / " in title:
            return slugify(title.split(" / ")[-1])
        return slugify(title)
    tail = url.rstrip("/").split("/")[-1]
    return slugify(tail)

def extract_picture_paths(html: str):
    paths = re.findall(r'href="(picture\?/\d+/(?:category|search)/[^"]+)"', html)
    if not paths:
        paths = re.findall(r'href="(picture\?/\d+[^"]*)"', html)
    return list(dict.fromkeys(paths))

for target in targets:
    print(f"\\nTARGET: {target}")
    album_html = urlopen(target).read().decode("utf-8", "ignore")
    folder = extract_name(target, album_html)
    os.makedirs(folder, exist_ok=True)

    picture_paths = extract_picture_paths(album_html)
    print(f"found {len(picture_paths)} picture pages -> {folder}")

    for i, path in enumerate(picture_paths, 1):
        page_url = urljoin(base, path)
        html = urlopen(page_url).read().decode("utf-8", "ignore")

        title = extract_title(html) or f"card_{i:03d}"
        if " | " in title:
            title = title.split(" | ")[0].strip()

        candidates = re.findall(r"changeImgSrc\('([^']+\.jpg)'", html)
        if not candidates:
            print(f"skip {title}: no image candidates")
            continue

        chosen = None
        for suffix in size_priority:
            for c in candidates:
                if c.endswith(suffix):
                    chosen = c
                    break
            if chosen:
                break

        if not chosen:
            chosen = candidates[-1]

        image_url = urljoin(base, chosen)
        safe_title = slugify(title)
        filename = os.path.join(folder, f"{safe_title}.jpg")

        print(f"[{i}/{len(picture_paths)}] {filename}")
        urlretrieve(image_url, filename)
        time.sleep(0.2)
