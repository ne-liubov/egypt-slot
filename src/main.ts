import './main.css';
import { SlotScene } from './scene/SlotScene';
import { SlotUI } from './ui/SlotUI';
import { SlotViewModel } from './viewmodel/SlotViewModel';

const vm = new SlotViewModel();
const appContainer = document.querySelector<HTMLElement>('#app')!;
const ui = new SlotUI(vm);
void new SlotScene(vm).mount(appContainer, [ui]);
