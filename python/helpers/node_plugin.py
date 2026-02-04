from abc import ABC, abstractmethod

class NodePlugin(ABC):
    """
    Task 8: Universal Node Extensibility.
    Standardized Interface for Agent Tools to render custom UI on the Canvas.
    Tools return a `render_schema` that the React 'UniversalNode' interprets.
    """
    
    @abstractmethod
    def get_ui_schema(self):
        pass

    def render_progress(self, progress: float, label: str):
        """Standard Progress Bar"""
        return {
            "type": "progress_bar",
            "props": {
                "value": progress,
                "label": label,
                "color": "neon-blue"
            }
        }

    def render_stream(self, stream_url: str, mime_type: str):
        """Live Media Stream"""
        return {
            "type": "media_stream",
            "props": {
                "src": stream_url,
                "mime": mime_type,
                "autoplay": True
            }
        }

    def render_data_grid(self, data: list, columns: list):
        """Dynamic Data Table"""
        return {
            "type": "data_grid",
            "props": {
                "rows": data,
                "columns": columns,
                "sortable": True
            }
        }
