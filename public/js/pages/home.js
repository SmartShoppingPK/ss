import '../lib/layout.js';
import { api } from '../lib/api.js';
import { show } from '../lib/cards.js';
const grid = document.querySelector('#grid');
api('/products').then(l => show(l.slice(0, 4), grid, 'No products yet. New finds are coming soon.')).catch(() => show([], grid, 'Could not load products. Refresh the page.'));
