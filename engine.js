function generateMaze(cols, rows, seed=42) {
  function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  const cells = Array.from({ length: cols * rows }, () => ({ walls: [true, true, true, true], visited: false }));
  const stack = [0];
  cells[0].visited = true;
  // Busca em profundidade: remove uma parede entre vizinhos ainda não visitados.
  while (stack.length) {
    const index = stack[stack.length - 1];
    const x = index % cols;
    const y = Math.floor(index / cols);
    const choices = [];
    [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dx, dy], direction) => {
      const nx = x + dx, ny = y + dy;
      const next = ny * cols + nx;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !cells[next].visited) choices.push({ next, direction });
    });
    if (!choices.length) { stack.pop(); continue; }
    const choice = choices[Math.floor(random() * choices.length)];
    cells[index].walls[choice.direction] = false;
    cells[choice.next].walls[(choice.direction + 2) % 4] = false;
    cells[choice.next].visited = true;
    stack.push(choice.next);
  }
  return { cols, rows, cells };
}


function geometry(m){const walls=[];m.cells.forEach((c,i)=>{let x=i%m.cols/m.cols,y=Math.floor(i/m.cols)/m.rows,w=1/m.cols,h=1/m.rows;if(c.walls[0])walls.push([x,y,x+w,y]);if(c.walls[3])walls.push([x,y,x,y+h]);});walls.push([0,1,1,1],[1,0,1,1]);return walls;}
function move(p,target,dt,walls){let hits=new Set(),distance=Math.hypot(target.x-p.x,target.y-p.y),length=Math.min(distance,.25*dt),steps=Math.max(1,Math.ceil(length/.004)),q={...p};if(!distance)return {position:q,hits:[]};for(let i=0;i<steps;i++)for(const axis of ['x','y']){let next={...q,[axis]:q[axis]+(target[axis]-p[axis])/distance*length/steps};let blocked=false;walls.forEach(([x,y,a,b],id)=>{let nx=Math.max(Math.min(x,a),Math.min(Math.max(x,a),next.x)),ny=Math.max(Math.min(y,b),Math.min(Math.max(y,b),next.y));if(Math.hypot(next.x-nx,next.y-ny)<.0125){hits.add(id);blocked=true;}});if(!blocked)q=next;}return {position:q,hits:[...hits]};}
function solution(m){let queue=[[0]],seen=new Set([0]);while(queue.length){let path=queue.shift(),i=path.at(-1);if(i===m.cells.length-1)return path;m.cells[i].walls.forEach((wall,d)=>{let j=i+[-m.cols,1,m.cols,-1][d];if(!wall&&!seen.has(j)){seen.add(j);queue.push([...path,j]);}});}}
module.exports={generateMaze,geometry,move,solution};
