declare module "gray-matter" {
  interface GrayMatterFile {
    data: Record<string, unknown>;
    content: string;
    excerpt?: string;
    orig: string | Buffer;
  }
  function matter(input: string | Buffer): GrayMatterFile;
  export = matter;
}
