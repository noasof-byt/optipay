import "server-only";
/**
 * Playwright Engine — STUB
 *
 * Playwright has been removed from this project.
 * Club-benefit scraping now uses the Cheerio strategy exclusively.
 * This file exists only to prevent import errors in legacy files
 * that haven't been migrated yet.
 */

export async function acquirePage(): Promise<never> {
  throw new Error("Playwright has been removed. Use the Cheerio scraping strategy.");
}

export async function releasePage(): Promise<void> {}
export async function closeBrowser(): Promise<void> {}
export async function navigateTo(): Promise<void> {}
export async function scrollToBottom(): Promise<void> {}
export async function extractTexts(): Promise<string[]> { return []; }
export async function clickNextPage(): Promise<boolean> { return false; }
