# Display-list viewer

## Format for display-lists is here

[Documentation for display-list format](docs/display-list-format.md)


## How to start working on this project

1. Start the Vite dev server on `hermes`:

```bash
ssh meister@hermes
cd ~/Development/display-list
npm run dev -- --host 127.0.0.1 --port 5173
```

2. From your local machine, create the SSH tunnel:

```bash
ssh -L 5173:127.0.0.1:5173 meister@hermes
```

Leave this SSH session running. It forwards local port 5173 to 127.0.0.1:5173 on hermes.

3. Open the app in your local browser

```text
http://localhost:5173
```

4. Edit the code on hermes

```bash
ssh meister@hermes
cd ~/Development/display-list
emacs .
```


