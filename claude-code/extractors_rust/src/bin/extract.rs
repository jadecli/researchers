//! CLI tool: reads HTML from stdin, outputs markdown and quality score.

use std::io::{self, Read};

use clap::Parser;
use serde_json::json;

use extractors_rust::markdown::html_to_markdown;
use extractors_rust::quality::score_extraction;

#[derive(Parser)]
#[command(name = "extract")]
#[command(about = "Extract markdown from HTML and score quality")]
struct Cli {
    /// Output format: "json" or "text"
    #[arg(short, long, default_value = "json")]
    format: String,

    /// Only output the quality score
    #[arg(long)]
    score_only: bool,
}

fn main() {
    let cli = Cli::parse();

    let mut html = String::new();
    io::stdin()
        .read_to_string(&mut html)
        .expect("Failed to read from stdin");

    if html.trim().is_empty() {
        eprintln!("No HTML input provided on stdin");
        std::process::exit(1);
    }

    let markdown = html_to_markdown(&html);
    let quality_score = score_extraction(&markdown);

    if cli.score_only {
        println!("{:.4}", quality_score);
        return;
    }

    match cli.format.as_str() {
        "json" => {
            let output = json!({
                "markdown": markdown,
                "quality_score": quality_score,
                "word_count": markdown.split_whitespace().count(),
                "line_count": markdown.lines().count(),
            });
            println!("{}", serde_json::to_string_pretty(&output).unwrap());
        }
        "text" => {
            println!("{}", markdown);
            eprintln!("\n--- Quality Score: {:.4} ---", quality_score);
        }
        other => {
            eprintln!("Unknown format: {}. Use 'json' or 'text'.", other);
            std::process::exit(1);
        }
    }
}
