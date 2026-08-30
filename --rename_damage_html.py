from pathlib import Path

path = Path('/mnt/99e98163-c0d2-480e-a2c7-54ab68635a91/irent-project/damage-review.html')
text = path.read_text(encoding='utf-8')
replacements = {
    'assets/damage-review/case-01-before.png': 'assets/damage-review/RAC-4582_20260809-09-14-00_01.png',
    'assets/damage-review/case-01-after.png': 'assets/damage-review/RAC-4582_20260809-13-37-00_02.png',
    'assets/damage-review/case-02-before.png': 'assets/damage-review/RBC-2108_20260809-10-22-00_01.png',
    'assets/damage-review/case-02-after.png': 'assets/damage-review/RBC-2108_20260809-14-05-00_02.png',
    'assets/damage-review/case-03-before.png': 'assets/damage-review/RBA-6935_20260809-08-47-00_01.png',
    'assets/damage-review/case-03-after.png': 'assets/damage-review/RBA-6935_20260809-12-18-00_02.png',
}
for old, new in replacements.items():
    text = text.replace(old, new)
path.write_text(text, encoding='utf-8', newline='')
print('updated image references')
