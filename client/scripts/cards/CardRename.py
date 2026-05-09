from pathlib import Path

folder = Path("search-psk-20260509-Y1EkFbYRnd")

forward = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
backward = ["K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2", "A"]

target_names = (
        [f"{rank}S.jpg" for rank in forward] +
        [f"{rank}D.jpg" for rank in forward] +
        [f"{rank}C.jpg" for rank in backward] +
        [f"{rank}H.jpg" for rank in backward]
)

files = sorted(folder.glob("*.jpg"))

if len(files) < len(target_names):
    print(f"Not enough files: found {len(files)}, need {len(target_names)}")
else:
    for src, new_name in zip(files, target_names):
        dst = folder / new_name
        print(f"{src.name} -> {dst.name}")
        src.rename(dst)