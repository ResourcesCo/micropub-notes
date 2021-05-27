async function getData() {
  const resp = await fetch('/api/notes');
  const data = await resp.json();
  const el = document.getElementById('notes');
  el.innerText = data.content;
}

getData();
