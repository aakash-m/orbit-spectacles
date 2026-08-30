Two cleanup items before I record, nothing that touches runtime behaviour:

1. Secrets audit — I'm publishing this repo publicly. Check every tracked file
for RSG tokens, API keys, or credentials (OrbitConfig especially), confirm
.gitignore covers them, and tell me exactly what you find and what needs to
move out of version control. Do not commit anything until I've seen this.

2. Confirm trace_processor_shell.exe lives outside the project directory and
won't be committed. Note in FINDINGS.md that Perfetto's trace processor was
fetched for the analysis.

3. Delete the Echopark asset folder (Diffuse/Specular/Render Target) if nothing
references it.

Leave debugForceEmptyKey and debugReplyKey ON — I need them for filming.