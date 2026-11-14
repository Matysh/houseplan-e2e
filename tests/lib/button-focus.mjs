import { expect } from '@playwright/test';
import { installedRecord } from './contract.mjs';
import { compareTags } from '../../scripts/tags.mjs';

export const hasSingleBorderFocus = () => !installedRecord()?.version ||
  compareTags(`v${installedRecord().version}`, 'v1.85.3-beta.1') >= 0;

// Native Tab, not focus() on the asserted target. The disposable preceding
// stop avoids browser chrome without changing the product's tab order.
export async function tabTo(page, target) {
  await target.evaluate(el => {
    const stop = document.createElement('span'); stop.tabIndex = 0;
    stop.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';
    stop.dataset.e2eFocusStop = ''; el.before(stop); stop.focus();
  });
  try { await page.keyboard.press('Tab'); await expect(target).toBeFocused(); }
  finally { await target.evaluate(el => el.previousElementSibling?.matches('[data-e2e-focus-stop]') && el.previousElementSibling.remove()); }
}

export async function oneBorder(target, { size, composite = false } = {}) {
  await expect(target).toHaveClass(composite ? /hpf-keyboard-current/ : /hpf-tab-focus/);
  await expect.poll(() => target.evaluate(el => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    const accent = s.getPropertyValue('--hpf-accent').trim() || s.getPropertyValue('--primary-color').trim();
    const probe = document.createElement('span'); probe.style.color = accent; el.append(probe);
    const expected = getComputedStyle(probe).color; probe.remove();
    return { border:s.borderTopWidth, color:s.borderTopColor, expected, outline:s.outlineStyle, shadow:s.boxShadow,
      width:r.width, height:r.height };
  })).toMatchObject({ border:'1px', outline:'none', shadow:'none', ...(size ? {width:size,height:size} : {}) });
  const colors = await target.evaluate(el => {
    const s=getComputedStyle(el), probe=document.createElement('span');
    probe.style.color='var(--hpf-accent,var(--primary-color))'; el.append(probe);
    const pair=[s.borderTopColor,getComputedStyle(probe).color]; probe.remove(); return pair;
  });
  expect(colors[0]).toBe(colors[1]);
}

export async function noOuterFocus(target) {
  await expect(target).not.toHaveClass(/hpf-(tab-focus|keyboard-current)/);
  await expect.poll(() => target.evaluate(el => [getComputedStyle(el).outlineStyle,getComputedStyle(el).boxShadow])).toEqual(['none','none']);
}
