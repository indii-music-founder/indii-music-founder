
import * as dom from './dom';
import * as ui from './ui';
import * as gallery from './gallery';
import * as canvasLogic from './canvas';
import * as dashboard from './dashboard';

export type ViewState = 'dashboard' | 'studio';

export function switchView(view: ViewState) {
    if (view === 'dashboard') {
        dom.viewDashboard.classList.remove('hidden');
        dom.viewStudio.classList.add('hidden');
        // Refresh Dashboard Data
        dashboard.renderProjectGrid();
    } else {
        dom.viewDashboard.classList.add('hidden');
        dom.viewStudio.classList.remove('hidden');
        
        // Trigger resize for canvas/layout
        setTimeout(() => {
            canvasLogic.drawCanvas();
            gallery.updateGalleryUI();
        }, 100);
    }
}
