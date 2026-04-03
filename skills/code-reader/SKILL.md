# Code Reading

Use the built-in filesystem tools for code navigation and inspection.

- Use `glob` to find candidate files.
- Use `grep` to search for symbols or text.
- Use `read_file` with focused offsets and limits to inspect only the relevant code ranges.

Avoid reading large files all at once. Narrow down with `glob` and `grep` first, then read only the relevant sections.
