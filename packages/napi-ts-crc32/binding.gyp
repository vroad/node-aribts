{
  "targets": [
    {
      "target_name": "addon",
      "cflags": ["-march=native"],
      "cflags_cc": ["-march=native"],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "sources": [
        "addon.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": [
      ],
    }
  ]
}
