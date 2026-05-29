file = 'packages/renderer/src/modules/social/components/CreatePostModal.tsx'
with open(file, 'r') as f:
    lines = f.read().split('\n')

new_lines = []
for i, line in enumerate(lines):
    if i != 62: # line 63
        new_lines.append(line)
    else:
        print(f"Removed {line}")
with open(file, 'w') as f:
    f.write('\n'.join(new_lines))
