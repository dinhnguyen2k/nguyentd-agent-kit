# Quy trình benchmark hiệu năng E2E

Áp dụng khi cần đo một thao tác thật từ trình duyệt đến backend, ví dụ lọc báo cáo, tải bảng hoặc xuất Excel.
Số đo endpoint không thay cho số đo trải nghiệm người dùng.

## 1. Chốt bài đo trước khi sửa

- Chốt route, tài khoản kiểm thử và phạm vi quyền, thao tác bắt đầu, tín hiệu hoàn tất, bộ lọc, bộ dữ liệu và kết quả nghiệp vụ mong đợi.
- Chọn trước một phép so sánh chính gắn với phần vừa sửa; mặc định dùng một ca tiêu biểu hoặc ca nặng nếu giả thuyết chỉ xuất hiện ở tải lớn.
Các ca biên chỉ kiểm tính đúng, trừ khi cần kết luận hiệu năng riêng cho ca đó.
- Khóa phiên bản chạy của cả frontend và backend theo commit hoặc dấu vân tay mã nguồn; không đo trên frontend tự nạp lại từ cây đang sửa.
Ghi cấu hình build, DB, trình duyệt, điều kiện cache và phạm vi quyền cho cả hai bản.
- Chốt giới hạn riêng cho chuẩn bị và lấy mẫu, số lần thử lại, cùng ngưỡng cải thiện nếu đã có căn cứ; không tự đặt SLA.
Khi hết giới hạn, xuất số đã có và trạng thái chưa đủ bằng chứng, không tự kéo dài hoặc mở rộng bài đo.
- Giao agent phụ trách thay đổi làm đầu mối đo theo [quy tắc phân vai benchmark](../../../rules/performance-decision-rules.md#phân-vai-benchmark).
Dùng kịch bản và driver sẵn có; chốt phiên bản kịch bản, bộ lọc, chỉ số và cách đối soát trước khi lấy mẫu.
Nếu kịch bản hoặc điều kiện đo đổi giữa chừng, không ghép số cũ với số mới; chỉ đo lại hai bản trong giới hạn đã cấp hoặc báo không so sánh được.
Cần build bản đo thì giao riêng lệnh build đã được cấp quyền và nhận lại đường dẫn bản chạy kèm mã phiên bản; đầu mối đo không đổi.
Có thể chuẩn bị và đo bản gốc trong khi người khác sửa mã nếu môi trường bản gốc cô lập và không tranh tài nguyên; chỉ đo bản sửa khi bản build đã cố định.
Chỉ chạy Playwright, build, app hoặc profiling trong phạm vi được người dùng cho phép.
Không tự chạy tải trên production hoặc khởi động lại dịch vụ dùng chung.

## 2. Chuẩn bị dữ liệu tái lập

- Ưu tiên fixture có sẵn; khi thiếu tải đại diện, dùng bộ sinh dữ liệu quyết định được bởi seed và đồng hồ cố định.
Chỉ tạo dữ liệu trong môi trường benchmark cô lập khi có quyền; không ghi vào DB phát triển dùng chung hoặc production.
- Chọn phân bố theo giả thuyết: số dòng mỗi kỳ, độ chọn lọc theo dự án, số dòng con mỗi biên bản, danh mục lớn hoặc dữ liệu lịch sử.
Giữ một tập nhỏ có kết quả kỳ vọng tính độc lập để kiểm nghiệp vụ, và chỉ tạo tập tải lớn khi phép so sánh cần nó.
- Ghi phiên bản bộ sinh, seed, mốc thời gian, mã snapshot, quy mô/phân bố và kết quả kỳ vọng.
Tạo dữ liệu ngoài khoảng đo; với báo cáo chỉ đọc, tái sử dụng cùng snapshot cho cả hai bản và không reset sau từng lượt nếu dữ liệu không đổi.
Nếu phải đổi ngữ nghĩa bộ lọc hoặc dataset giữa hai bản, báo số quan sát riêng, không coi đó là so sánh cùng tải.

## 3. Kiểm nhanh trên cả hai bản

- Dùng driver đăng nhập kiểm thử sẵn có của dự án; đăng nhập ngoài khoảng đo và xác nhận đúng quyền, route, phiên bản frontend/backend và bộ dữ liệu.
Chạy một lượt thật trên mỗi bản trước khi lặp; dừng sớm nếu bản chạy, bộ lọc hoặc kết quả đối soát không đúng.
Kiểm nhanh chỉ cho biết kịch bản và dữ liệu có hợp lệ hay không, không dùng để công bố mức cải thiện.
- Với **lọc/tải bảng**, bắt đầu ngay trước thao tác người dùng, kết thúc khi dữ liệu của chính bộ lọc vừa áp dụng đã hiển thị đúng và trạng thái tải kết thúc; không dùng delay cố định, `networkidle` hay HTTP 200 làm tín hiệu duy nhất.
Không mở lại trang hoặc đăng nhập lại mỗi lượt nếu bài đo không nhắm vào các thao tác đó; đặt lại trạng thái bộ lọc/cache theo kịch bản.
- Với **xuất Excel**, bắt đầu ngay trước khi bấm Xuất, kết thúc khi trình duyệt tải file thành công; sự kiện `download` chỉ báo bắt đầu, phải đợi `download.failure()` trả `null` hoặc `download.path()` thành công.
Đọc file và đối soát nội dung sau khi dừng đồng hồ; không tính thời gian copy artifact hoặc đọc file vào thời gian người dùng chờ.
- Đối soát với fixture hoặc kết quả tính độc lập: khóa dòng, số dòng, nhóm, tổng, phạm vi dữ liệu và quyền theo yêu cầu nghiệp vụ.
Không lấy riêng bản cũ làm chuẩn, nhất là khi task sửa bộ lọc hoặc công thức.
Nếu kiểm sai thì dừng phép so sánh ở ca đó; dù nhanh hơn, kết quả vẫn không đạt.

## 4. Xác nhận hiệu năng và điều tra khi cần

- Với mỗi phép so sánh cần kết luận: làm nóng ít nhất một lượt không tính rồi thu ít nhất 7 lượt hợp lệ mỗi bản; lưu kết quả sau từng lần thử, kể cả lượt lỗi và timeout.
Giữ cùng fixture, bộ lọc, quyền, cấu hình build và điều kiện cache; nếu cần đo nguội và ấm thì tách thành hai ca, không gộp.
- Đo tuần tự, xen kẽ bản gốc/bản sửa theo từng cặp nếu có hai bản chạy; nếu không, đo lại bản gốc cuối đợt để phát hiện trôi.
Không chạy đồng thời hai bài benchmark, build, hoặc profiling nặng trên tài nguyên dùng chung với lượt đo.
- Ghi thời gian E2E, số request liên quan, thời gian request chính và dung lượng file nếu có.
Dùng trace/timing sẵn có để khoanh đúng tầng nghi vấn (DB/gRPC, dựng/ghi workbook, truyền tải hoặc cập nhật UI) khi E2E chưa giải thích được nút thắt; không mặc định mở thêm mọi bài đo tầng dưới.
Thiếu thời gian ở một tầng thì ghi là chưa có số đo; không suy ra thời gian DB từ tổng thời gian HTTP.
- Nếu cần quy mức cải thiện cho một tối ưu cụ thể, so hai bản chỉ khác tối ưu đó trên cùng fixture.
Nếu đã đổi nhiều phần cùng lúc, chỉ kết luận mức cải thiện của cả luồng; số đo từng pha dùng để khoanh vùng, không dùng để gán phần trăm cải thiện cho từng thay đổi.
- Khi lỗi hạ tầng, kiểm tra nguyên nhân một lần trong phạm vi đã được cấp; ví dụ với `401`, xác nhận lại phiên ngoài vùng đo rồi thử lại một lần.
Nếu lỗi lặp, sai phiên bản, dữ liệu trôi hoặc hết giới hạn thời gian, dừng và lưu phần đã có thay vì tự tăng timeout, đổi fixture hoặc bỏ mẫu xấu.

## 5. Đọc số và bàn giao

- Báo theo từng ca: thao tác và mốc kết thúc, commit/cấu hình hai bản, fixture và quy mô, số lượt hợp lệ/tổng lần thử, median/min/max, chênh lệch, kết quả đối soát, lỗi và đường dẫn số đo thô đã che thông tin nhạy cảm.
Không gọi max là p95; không dùng phân vị đuôi từ 7 lượt để cam kết SLA.
- Khi thí điểm quy trình, ghi riêng thời gian chờ bản chạy, thời gian chạy bài đo hợp lệ và thời gian làm lại do môi trường.
Dùng ba số này để quyết định nên giảm chuyển giao, sửa khâu chuẩn bị hay rút gọn bài đo; không gộp chúng vào độ trễ của ứng dụng.
- Kết luận riêng **đúng nghiệp vụ**, **nhanh/chậm hơn có bằng chứng**, hoặc **chưa đủ bằng chứng hiệu năng**.
Khi mức chênh không tách được khỏi nhiễu, thiếu mẫu hoặc khác ngữ nghĩa đầu ra, không kết luận có cải thiện.
Số đo API vẫn có thể hữu ích để khoanh tầng, nhưng không được báo là E2E.
- Ghi rõ phần chưa đo; dọn trình duyệt, dịch vụ và artifact tạm do chính lượt đo tạo theo quyền đã cấp.
Chỉ chuyển phép đo thành kiểm tra định kỳ khi kịch bản tái lập được, môi trường đủ ổn định và đã có ngưỡng gắn với trải nghiệm người dùng.

## Ca mẫu: báo cáo nghiệm thu thuần tổ

- Đo riêng **áp dụng bộ lọc tới khi bảng hiện dữ liệu đúng** và **bấm Xuất tới khi tải xong Excel**.
Dùng fixture có ít nhất hai dự án cùng kỳ để phát hiện lọc nhầm, với quy mô kỳ thường và cao điểm khi cần kiểm khả năng tăng tải.
- Với tối ưu backend, tạo dự án ít dòng và nhiều dòng; kiểm không lọc, lọc dự án và lọc lệnh sản xuất, đo lặp đúng ca đã chọn.
Nếu sửa phân giải định danh dự án, thêm ca dữ liệu cũ thiếu `ProjectId` hoặc WorkItem thiếu `RefDocId`; xác định trước dòng nào phải được giữ hoặc loại theo nghiệp vụ.
- Với tối ưu danh mục, tăng số lệnh và biên bản; đo lúc mở trang và lần đầu mở ô chọn nếu chuyển sang tải theo nhu cầu.
- Với tối ưu xuất Excel, tăng số biên bản và chi tiết trên mỗi kỳ; nếu có số đo phù hợp, ghi thời gian ghi workbook và đỉnh bộ nhớ ngoài số đo tải file.
- Tính từ dữ liệu chi tiết mong đợi: khóa và số dòng, số biên bản phân biệt, tổng thành tiền theo tổ và theo biên bản; so với các bảng trên UI và ba sheet Excel.
Nếu các tab thể hiện các đại lượng khác nhau, đối soát mỗi đại lượng theo đúng định nghĩa của nó, không ép số bằng nhau.

Tham khảo: [Playwright: mốc hoàn tất tải file](https://playwright.dev/docs/api/class-download), [Microsoft: benchmark có giả thuyết và môi trường tương đương](https://learn.microsoft.com/en-us/azure/well-architected/performance-efficiency/performance-test), [Kalibera và Jones: tập trung phép lặp vào nơi có nhiều biến động](https://kar.kent.ac.uk/33611/).
