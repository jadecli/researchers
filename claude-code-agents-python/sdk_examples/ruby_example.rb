# Ruby SDK example: create message, tool use, and streaming
# with the Anthropic API.
#
# Install: gem install anthropic-rb
# Or add to Gemfile: gem "anthropic-rb"

require "net/http"
require "json"
require "uri"

API_KEY = ENV.fetch("ANTHROPIC_API_KEY")
API_URL = URI("https://api.anthropic.com/v1/messages")

# Build HTTP request with Anthropic headers.
def build_request(body)
  request = Net::HTTP::Post.new(API_URL)
  request["x-api-key"] = API_KEY
  request["anthropic-version"] = "2023-06-01"
  request["content-type"] = "application/json"
  request.body = body.to_json
  request
end

# Send a request and parse the JSON response.
def send_request(body)
  http = Net::HTTP.new(API_URL.host, API_URL.port)
  http.use_ssl = true
  response = http.request(build_request(body))
  JSON.parse(response.body)
end

# Basic message creation.
def create_message_example
  response = send_request(
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      { role: "user", content: "Explain quantum computing in one paragraph." }
    ]
  )

  content = response.dig("content", 0)
  if content && content["type"] == "text"
    puts "Response: #{content['text']}"
  end

  usage = response["usage"]
  puts "Usage: #{usage['input_tokens']} in, #{usage['output_tokens']} out"
end

# Tool use (function calling) example.
def tool_use_example
  tools = [
    {
      name: "get_weather",
      description: "Get the current weather for a given location.",
      input_schema: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "City and state, e.g. San Francisco, CA"
          },
          unit: {
            type: "string",
            enum: %w[celsius fahrenheit],
            description: "Temperature unit"
          }
        },
        required: ["location"]
      }
    }
  ]

  response = send_request(
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    tools: tools,
    messages: [
      { role: "user", content: "What's the weather in San Francisco?" }
    ]
  )

  response["content"].each do |block|
    next unless block["type"] == "tool_use"

    puts "Tool call: #{block['name']}"
    puts "Input: #{block['input'].to_json}"
  end
end

# Streaming response example using SSE.
def streaming_example
  body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    stream: true,
    messages: [
      { role: "user", content: "Write a haiku about programming." }
    ]
  }

  http = Net::HTTP.new(API_URL.host, API_URL.port)
  http.use_ssl = true

  request = build_request(body)

  http.request(request) do |response|
    buffer = ""
    response.read_body do |chunk|
      buffer += chunk
      while (line_end = buffer.index("\n"))
        line = buffer.slice!(0..line_end).strip
        next if line.empty?
        next unless line.start_with?("data: ")

        data = line.sub("data: ", "")
        break if data == "[DONE]"

        begin
          event = JSON.parse(data)
          if event["type"] == "content_block_delta"
            delta = event.dig("delta")
            if delta && delta["type"] == "text_delta"
              print delta["text"]
            end
          end
        rescue JSON::ParserError
          next
        end
      end
    end
  end
  puts
end

if __FILE__ == $PROGRAM_NAME
  puts "=== Create Message ==="
  create_message_example

  puts "\n=== Tool Use ==="
  tool_use_example

  puts "\n=== Streaming ==="
  streaming_example
end
