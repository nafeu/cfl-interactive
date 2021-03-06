var socket = io({
  'reconnection': true,
  'reconnectionDelay': 100,
  'reconnectionAttempts': 50
});

var publicComments,
    questionsArea,
    quizArea,
    questionsContent,
    modalContainer,
    quizResultsChart,
    quizStats,
    quizContent,
    videoArea,
    currQuestionsState = {},
    currQuizState = {};

// PDF.js Configs
var pdfDoc = null,
    pageNum = 1,
    pageRendering = false,
    pageNumPending = null,
    scale = 1,
    scaleUpperLimit = 3,
    scaleLowerLimit = 0.5,
    scaleIncrement = 0.1,
    canvas = document.getElementById('the-canvas'),
    ctx = canvas.getContext('2d'),
    url = '../assets/example.pdf';

var youtubeVideo,
    startSeconds = 0,
    videoState = null,
    videoDone = false;

// ---------------------------------------------------------------------------
// Socket Event Handlers
// ---------------------------------------------------------------------------
// socket.on('disconnect', function(){
//   confirm("You lost connection, please refresh page to interact again...");
// })

socket.on('new connection', function(data){
  console.log("connected with id: " + data.id);
  socket.emit('get-state');
})

socket.on('test', function(data){
  alert('test payload: ' + JSON.stringify(data));
});

socket.on('next-page', function(){
  handleNextPage();
})

socket.on('previous-page', function(){
  handlePreviousPage();
})

socket.on('zoom-in', function(){
  handleZoomIn();
})

socket.on('zoom-out', function(){
  handleZoomOut();
})

socket.on('update-questions-state', function(newState){
  if (stateUpdated(currQuestionsState, newState)) {
    console.log("[ instructor.js ] Updating questions state --> " + JSON.stringify(newState))
    currQuestionsState = newState;
    renderQuestions(currQuestionsState);
  }
});

socket.on('update-quiz-state', function(newState){
  if (stateUpdated(currQuizState, newState)) {
    console.log("[ instructor.js ] Updating quiz state --> " + JSON.stringify(newState))
    currQuizState = newState;
    renderQuiz(currQuizState);
  }
});

socket.on('toggle-interaction', function(){
  handleToggleInteraction();
});

socket.on('open-video', function(data){
  createNewYoutubeVideo(data.videoId, data.startSeconds);
})

socket.on('pause-play-video', function(){
  if (youtubeVideo && videoState) {
    if (videoState == 1) {
      youtubeVideo.pauseVideo();
    } else if (videoState == 2) {
      youtubeVideo.playVideo();
    }
  }
})

socket.on('close-video', function(){
  removeVideo();
})

function renderQuestions(state) {
  questionsContent.empty();

  state.approvedQuestions.sort(function(a, b) {
    return b.votes - a.votes;
  })
  state.approvedQuestions.forEach(function(question){
    questionsContent.append(createQuestionElement(question, "display-question row"));
  })
}

function renderQuiz(state) {
  quizResultsChart.data.datasets[0].data = state.data;
  quizResultsChart.data.labels = state.labels;
  quizResultsChart.update();
  quizStats.empty();
  if (state.data.length > 0) {
    if (state.data.reduce(add, 0) > 0) {
      quizStats.append("<p>Top result is <span class='bold-info'>" + state.labels[indexOfMax(state.data)] + "</span> with " + state.data[indexOfMax(state.data)] + " vote(s).");
    }
    state.data.forEach(function(item, index){
      quizStats.append("<p>" + state.labels[index] + ": <span class='bold-info'>" + item + "</span></p>");
    });
  }
}

function createQuestionElement(question, className) {
  var out = $("<div>", {class: className});
  var text = $("<div>", {class: "question-text"}).text(question.text);
  var votes = $("<div>", {class: "question-votes"}).text(question.votes);

  out.append(text);
  return out;
}

// ---------------------------------------------------------------------------
// Event Handlers
// ---------------------------------------------------------------------------
function handleNewScale(newScale) {
  scale = newScale;
  queueRenderPage(pageNum);
}

function handlePreviousPage() {
  if (pageNum <= 1) {
    return;
  }
  pageNum--;
  queueRenderPage(pageNum);
}

function handleNextPage() {
  if (pageNum >= pdfDoc.numPages) {
    return;
  }
  pageNum++;
  queueRenderPage(pageNum);
}

function handleZoomOut() {
  if (scale <= scaleLowerLimit) {
    return;
  }
  scale -= scaleIncrement;
  queueRenderPage(pageNum);
}

function handleZoomIn() {
  if (scale >= scaleUpperLimit) {
    return;
  }
  scale += scaleIncrement;
  queueRenderPage(pageNum);
}

function handleScrollDown() {
  questionsArea.scrollTop(questionsArea.scrollTop() + 100);
}

function handleScrollUp() {
  questionsArea.scrollTop(questionsArea.scrollTop() - 100);
}

function handleToggleInteraction() {
  questionsArea.toggle();
  quizArea.toggle();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function renderPage(num) {
  pageRendering = true;
  pdfDoc.getPage(num).then(function(page) {
    var viewport = page.getViewport(scale);
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    // Render PDF page into canvas context
    var renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };
    var renderTask = page.render(renderContext);
    // Wait for rendering to finish
    renderTask.promise.then(function() {
      pageRendering = false;
      if (pageNumPending !== null) {
        // New page rendering is pending
        renderPage(pageNumPending);
        pageNumPending = null;
      }
    });
  });
}

function queueRenderPage(num) {
  if (pageRendering) {
    pageNumPending = num;
  } else {
    renderPage(num);
  }
}

PDFJS.getDocument(url).then(function(pdfDoc_) {
  pdfDoc = pdfDoc_;

  renderPage(pageNum);
});

function createNewChart(labels) {
  var newData = [],
    newBackgroundColor = [],
    newBorderColor = [];

  labels.forEach(function(label){
    newData.push();
    newBackgroundColor.push('rgba(255, 255, 255, 1)');
    newBorderColor.push('rgba(255, 255, 255, 1)');
  })
  return new Chart(quizResultsContext, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: newData,
        backgroundColor: 'white',
        borderColor: 'white',
        borderWidth: 1,
      }]
    },
    options: {
      legend: {
        display: false,
      },
      tooltips: {
        enabled: false
      },
      scales: {
        yAxes: [{
          ticks: {
            display: false,
            beginAtZero: true,
          }
        }],
        xAxes: [{
          ticks: {
            fontSize: 25,
            fontColor: 'white',
          }
        }],
      },
    },
  });
}

function createNewYoutubeVideo(videoId, newStartSeconds) {
  startSeconds = newStartSeconds;
  youtubeVideo = new YT.Player('player', {
    height: $(window).height(),
    width: $(window).width(),
    videoId: videoId,
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
}

function onPlayerReady(event) {
  event.target.playVideo();
  if (parseInt(startSeconds) > 1) {
    event.target.seekTo(parseInt(startSeconds));
  }
}

function onPlayerStateChange(event) {
  videoState = event.data;
}

function removeVideo() {
  videoArea.empty();
  youtubeVideo = null;
  videoState = null;
  videoArea.append($("<div>", {id: "player"}));
}

$(document).ready(function(){
  console.log("[ viewer.js ] Document ready...");

  // DOM References
  body = $("body");
  questionsArea = $("#questions-area");
  quizArea = $("#quiz-area");
  questionsContent = $("#questions-content");
  quizContent = $("#quiz-content");
  quizResultsContext = document.getElementById("quiz-results-chart").getContext('2d');
  quizStats = $("#quiz-stats");
  videoArea = $("#video-area");

  // DOM Events
  $(window).resize(function(){
    updateHeight();
  });

  body.keydown(function(event){
    console.log(event.which);
    switch (event.which) {
      case 39: // "right"
        event.preventDefault();
        handleNextPage();
        break;
      case 37: // "left"
        event.preventDefault();
        handlePreviousPage();
        break;
      case 187: // "+"
        event.preventDefault();
        handleZoomIn();
        break;
      case 189: // "-"
        event.preventDefault();
        handleZoomOut();
        break;
      case 38: // "up"
        event.preventDefault();
        handleScrollUp();
        break;
      case 40: // "down"
        event.preventDefault();
        handleScrollDown();
        break;
      case 81: // "q"
        event.preventDefault();
        handleToggleInteraction();
        break;
    }
  });

  function updateHeight() {
    var newHeight = $(window).height()
    questionsArea.css('height', newHeight);
    quizArea.css('height', newHeight);
    if (youtubeVideo) {
      $("#player").css('height', newHeight);
      $("#player").css('width', $(window).width());
    }
  }

  function main() {
    updateHeight();
    quizArea.hide();
    quizResultsChart = createNewChart([""])
  }

  main();
});