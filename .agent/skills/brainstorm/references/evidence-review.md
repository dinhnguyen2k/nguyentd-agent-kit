# Deep Evidence Review

Chỉ dùng rubric này khi quyết định rủi ro cao, nguồn mâu thuẫn, credibility của practitioner ảnh hưởng kết luận, hoặc user yêu cầu nghiên cứu sâu.

## Evidence rubric

Đánh giá từng nguồn theo các chiều sau, không cộng thành điểm số giả chính xác:

- **Directness**: tác giả có trực tiếp xây dựng, vận hành, đo lường hoặc điều tra hệ thống không?
- **Authority**: nguồn có sở hữu spec, code, quyết định hoặc incident đang được viện dẫn không?
- **Context match**: workload, quy mô, consistency, latency, team capability và operational constraint có tương đồng không?
- **Method quality**: có dữ liệu, methodology, baseline, sample, giới hạn và cách tái hiện không?
- **Recency**: phiên bản, API và assumption còn hiện hành không?
- **Independence**: các nguồn có thật sự độc lập hay đều lặp lại một bài gốc?

Chức danh Senior, Solution Architect hoặc CTO chỉ là tín hiệu tìm kiếm.
Xác thực expertise bằng ownership, lịch sử đóng góp, bài viết kỹ thuật có chiều sâu, postmortem trực tiếp hoặc case triển khai liên quan.

## Claim discipline

Lập evidence matrix cho các claim quyết định:

| Claim | Type | Supporting evidence | Counterevidence | Context fit | Confidence |
| --- | --- | --- | --- | --- | --- |

`Type` chỉ dùng một trong: `fact`, `reported experience`, `inference`, `open question`.
Đặt link nguồn trực tiếp gần claim.
Không suy diễn benchmark, chức danh, quy mô hoặc consensus từ metadata mơ hồ.

Khi nguồn mâu thuẫn, kiểm tra theo thứ tự:

1. Hai nguồn có nói về cùng phiên bản và cùng cơ chế không?
2. Workload, scale, consistency và failure tolerance có khác nhau không?
3. Kết quả là benchmark kiểm soát, production observation hay opinion?
4. Có incentive thương mại hoặc selection bias đáng kể không?

Không ép ra consensus nếu khác biệt đến từ constraint thật.
Ghi rõ option nào phù hợp với từng điều kiện.

## Confidence

- **High**: primary evidence trực tiếp, nhiều case độc lập phù hợp bối cảnh, không còn phản chứng trọng yếu chưa giải thích.
- **Medium**: cơ chế rõ nhưng production evidence hạn chế hoặc context chỉ tương đối giống.
- **Low**: chủ yếu là opinion, nguồn gián tiếp/cũ, context khác đáng kể hoặc claim cần benchmark/POC.

Mọi kết luận Low confidence phải đi kèm cách kiểm chứng hoặc được giữ ở trạng thái open question.
