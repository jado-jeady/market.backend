# andasy.hcl app configuration file generated for marketpos on Wednesday, 11-Mar-26 16:50:42 SAST
#
# See https://github.com/quarksgroup/andasy-cli for information about how to use this file.

app_name = "marketpos"

app {

  env = {}

  port = 3000

  primary_region = "kgl"

  compute {
    cpu      = 1
    memory   = 256
    cpu_kind = "shared"
  }

  process {
    name = "marketpos"
  }

}
