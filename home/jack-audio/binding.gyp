{
  "targets": [
    {
      "target_name": "jack-audio",
      "sources": [ "src/jack-audio.cc" ],
      "include_dirs": [ "<!(node -e \"require('nan')\")" ],
      "libraries": [ "-ljack" ]
    }
  ]
}
