terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

variable "cf_api_token" {
  description = "Cloudflare api token"
  type        = string
  sensitive   = true
}

variable "cf_account_id" {
  description = "Cloudflare account id"
  type        = string
}

variable "cf_zone_id" {
  description = "Cloudflare zone id"
  type        = string
}

variable "cf_test_route" {
  description = "Cloudflare test route"
  type        = string
}

provider "cloudflare" {
  api_token = var.cf_api_token
}

resource "cloudflare_d1_database" "slumber_db" {
  account_id = var.cf_account_id
  name       = "slumber_db"
}

resource "cloudflare_worker_script" "slumber_updater" {
  account_id = var.cf_account_id
  name       = "slumber_updater"
  content    = file("updater/dist/index.js")
  module     = true

  d1_database_binding {
    database_id = cloudflare_d1_database.slumber_db.id
    name        = "db"
  }
}

/*
resource "cloudflare_worker_cron_trigger" "slumber_trigger" {
  account_id  = var.cf_account_id
  script_name = cloudflare_worker_script.slumber_updater.name
  schedules   = ["0 * * * *"]
}*/

resource "cloudflare_worker_route" "slumber_test" {
  zone_id     = var.cf_zone_id
  pattern     = var.cf_test_route
  script_name = cloudflare_worker_script.slumber_updater.name
}
