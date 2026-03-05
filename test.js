fetch("https://api.sumup.com/v0.1/me", {
  headers: { Authorization: "Bearer sup_sk_uUq2bmiI1qlkdNU2HI1ikbz9FYQokMv2G" },
})
  .then((r) => r.json())
  .then((d) => console.log(JSON.stringify(d, null, 2)))
  .catch((e) => console.error(e));
