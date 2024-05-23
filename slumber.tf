terraform {
    required_providers {
        cloudflare = {
            source = "cloudflare/cloudflare"
            version = "~> 4.0"
        }
    }
}

variable "cf_api_token" {
    description = "Cloudflare api token"
    type = string
    sensitive = true
}

variable "cf_account_id" {
    description = "Cloudflare account id"
    type = string
}

provider "cloudflare" {
    api_token = var.cf_api_token
}

resource "cloudflare_d1_database" "slumber_db" {
    account_id = var.cf_account_id
    name = "slumber_db"
}

resource "cloudflare_worker_script" "slumber_updater" {
    account_id = var.cf_account_id
    name = "slumber_updater"
    content = file("updater.js")

    d1_database_binding {
      database_id = cloudflare_d1_database.slumber_db.id
      name = "db"
    }
}

resource "cloudflare_worker_cron_trigger" "slumber_trigger" {
    account_id = var.cf_account_id
    script_name = cloudflare_worker_script.slumber_updater.name
    schedules = ["0 * * * *"]
}
