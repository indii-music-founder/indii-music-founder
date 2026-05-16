import os

# The exact strings from grep output
mapping = {
    "ðŸ’ ": "💠",
    "ðŸ —ï¸ ": "🏗️",
    "ðŸ“±": "📱",
    "ðŸ§ ": "🧠",
    "ðŸ“Š": "📊",
    "ðŸŒ ": "🌍",
    "ðŸ“¦": "📦",
    "ðŸŽ¨": "🎨",
    "ðŸ“ˆ": "📈",
    "ðŸ“£": "📣",
    "ðŸ› ï¸ ": "🛠️",
    "ðŸ” ": "🔐",
    "ðŸš€": "🚀",
    "ðŸ“œ": "📜",
    "ðŸ§ª": "🧪",
    "ðŸš¢": "🚢",
    "ðŸ“‚": "📂",
    "ðŸ”„": "🔄",
    "ðŸ¤–": "🤖",
    "ðŸ–¥ï¸ ": "🖥️",
    "ðŸ“ ": "📁",
    "ðŸ”’": "🔒",
    "â€”": "—"
}

with open('README.md', 'rb') as f:
    data = f.read()

for broken, fixed in mapping.items():
    data = data.replace(broken.encode('utf-8'), fixed.encode('utf-8'))

with open('README.md', 'wb') as f:
    f.write(data)
