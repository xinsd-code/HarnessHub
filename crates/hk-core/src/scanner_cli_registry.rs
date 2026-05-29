pub(crate) struct KnownCli {
    pub(crate) binary_name: &'static str,
    pub(crate) display_name: &'static str,
    pub(crate) api_domains: &'static [&'static str],
    pub(crate) credentials_path: Option<&'static str>,
    pub(crate) repo_url: Option<&'static str>,
}

pub(crate) static KNOWN_CLIS: &[KnownCli] = &[
    KnownCli {
        binary_name: "wecom-cli",
        display_name: "WeChat Work CLI",
        api_domains: &["qyapi.weixin.qq.com"],
        credentials_path: Some("~/.config/wecom/bot.enc"),
        repo_url: None,
    },
    KnownCli {
        binary_name: "lark-cli",
        display_name: "Lark / Feishu CLI",
        api_domains: &["open.feishu.cn", "open.larksuite.com"],
        credentials_path: Some("~/.config/lark/credentials"),
        repo_url: None,
    },
    KnownCli {
        binary_name: "dws",
        display_name: "DingTalk Workspace CLI",
        api_domains: &["api.dingtalk.com"],
        credentials_path: Some("~/.config/dws/auth.json"),
        repo_url: None,
    },
    KnownCli {
        binary_name: "meitu",
        display_name: "Meitu CLI",
        api_domains: &["openapi.mtlab.meitu.com"],
        credentials_path: Some("~/.meitu/credentials.json"),
        repo_url: None,
    },
    KnownCli {
        binary_name: "officecli",
        display_name: "OfficeCLI",
        api_domains: &[],
        credentials_path: None,
        repo_url: None,
    },
    KnownCli {
        binary_name: "notion-cli",
        display_name: "Notion CLI",
        api_domains: &["mcp.notion.com"],
        credentials_path: Some("~/.config/notion-cli/token.json"),
        repo_url: None,
    },
    KnownCli {
        binary_name: "opencli",
        display_name: "OpenCLI",
        api_domains: &[],
        credentials_path: None,
        repo_url: None,
    },
    KnownCli {
        binary_name: "cli-anything",
        display_name: "CLI-Anything",
        api_domains: &[],
        credentials_path: None,
        repo_url: None,
    },
];
