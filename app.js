document.addEventListener('DOMContentLoaded', () => {
  const content = document.getElementById('content1');
  const note = document.getElementById('note1');
  const btn = document.getElementById('ok');

  // Nạp dữ liệu đã lưu
  const saved = JSON.parse(localStorage.getItem('thu2') || '{}');
  content.value = saved.content || '';
  note.value = saved.note || '';

  btn.addEventListener('click', () => {
    localStorage.setItem('thu2', JSON.stringify({
      content: content.value,
      note: note.value
    }));
    alert('Đã lưu!');
  });
});
