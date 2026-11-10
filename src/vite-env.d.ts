/// <reference types="vite/client" />

declare module '*.md' {
  const article: { title: string; author: string; html: string; words: number };
  export default article;
}
