(function ($, ZombieTime) {
  'use strict';

  $.fn.zombieCountdown = function (options) {
    var settings = $.extend({ tick: 1000, label: 'until the dead rise' }, options);
    settings.label = $.trim(settings.label);

    if ($.browser.msie && parseInt($.browser.version, 10) < 9) {
      settings.tick = 5000;
    }

    return this.each(function () {
      var $el = $(this);
      var timer;

      function render() {
        var p = ZombieTime.parts(ZombieTime.nextHalloween(new Date()) - new Date());
        $el.find('.zc-days').text(ZombieTime.pad(p.days));
        $el.find('.zc-time').text([p.hours, p.minutes, p.seconds].map(ZombieTime.pad).join(':'));
        $el.find('.zc-label').text(settings.label);
      }

      render();
      timer = setInterval(render, settings.tick);

      $el.bind('zombie:stop', function () {
        clearInterval(timer);
        $el.unbind('zombie:stop');
      });

      $el.delegate('.zc-brains', 'click', function () {
        $el.toggleClass('zc-hungry');
      });

      if ($el.find('.zc-days').size() === 0) {
        $el.append('<span class="zc-days"></span> days <span class="zc-time"></span> <em class="zc-label"></em>');
      }
    });
  };

  $('.zombie-countdown').live('mouseenter', function () {
    $(this).addClass('zc-groan');
  });
}(jQuery, window.ZombieTime));
