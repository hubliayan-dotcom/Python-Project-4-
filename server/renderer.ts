import ejs from 'ejs';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
});

export function renderEmail(subjectTmpl: string, bodyMdTmpl: string, context: any) {
  try {
    // Render subject with EJS
    const subject = ejs.render(subjectTmpl, context);

    // Render body Markdown with EJS variables first
    const renderedMd = ejs.render(bodyMdTmpl, context);

    // Convert Markdown to HTML
    let html = md.render(renderedMd);

    // Add professional footer
    html += '<hr><p style="font-size:11px; color: #666;">You received this because you are part of our notification system. <br> Reply STOP to unsubscribe.</p>';

    return { subject, html };
  } catch (error) {
    console.error('Template render failed:', error);
    throw new Error(`Template render failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
